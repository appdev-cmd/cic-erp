import React, { useState, useMemo } from 'react';
import { Calculator, Download, Plus, Trash2, ArrowRight, Activity, ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';
import * as xlsx from 'xlsx';
import SearchableSelect from '../ui/SearchableSelect';
import QuickAddCustomerDialog from '../ui/QuickAddCustomerDialog';
import QuickAddProductDialog from '../ui/QuickAddProductDialog';
import { CustomerService } from '../../services/customerService';
import { ProductService } from '../../services/productService';
import { Customer, Product, PAKDRecord, PAKDLineItem, PAKDDynamicCost, Unit } from '../../types';
import { PAKDService } from '../../services/pakdService';
import { UnitService } from '../../services/unitService';

interface PAKDGeneratorProps {
    initialData?: PAKDRecord;
    onSave?: () => void;
    onCancel?: () => void;
}

const PAKDGenerator: React.FC<PAKDGeneratorProps> = ({ initialData, onSave, onCancel }) => {
    const [customerName, setCustomerName] = useState(initialData?.customerName || '');
    const [customerId, setCustomerId] = useState<string | null>(initialData?.customerId || null);
    const [projectName, setProjectName] = useState(initialData?.projectName || '');
    const [allocationType, setAllocationType] = useState<'branch' | 'unit'>(initialData?.allocationType || 'unit');
    const [units, setUnits] = useState<Unit[]>([]);
    const [selectedUnitId, setSelectedUnitId] = useState<string>(initialData?.department || '');

    // Dialog states
    const [isAddCustomerOpen, setIsAddCustomerOpen] = useState(false);
    const [isAddProductOpen, setIsAddProductOpen] = useState(false);
    const [addingProductToItemId, setAddingProductToItemId] = useState<string | null>(null);

    // Quick Add text memory
    const [searchCustomerText, setSearchCustomerText] = useState('');
    const [searchProductText, setSearchProductText] = useState('');

    const [items, setItems] = useState<PAKDLineItem[]>(initialData?.items || [
        { id: Date.now().toString(), name: '', quantity: 1, sellPrice: 0, costPrice: 0 }
    ]);

    // Load danh sách đơn vị khi mount
    React.useEffect(() => {
        UnitService.getAll().then(data => {
            setUnits(data);
            // Nếu có initialData.department, tìm unit tương ứng
            if (initialData?.department) {
                const found = data.find(u => u.name === initialData.department || u.id === initialData.department);
                if (found) {
                    setSelectedUnitId(found.id);
                    setAllocationType(found.type === 'Branch' ? 'branch' : 'unit');
                }
            }
        }).catch(err => console.error('Failed to load units:', err));
    }, []);

    // Chi phí động
    const [dynamicCosts, setDynamicCosts] = useState<PAKDDynamicCost[]>(initialData?.dynamicCosts || [
        { id: '1', name: 'Chi phí khác (Thuế n.thầu, Log...)', amount: 0 }
    ]);
    const [expertCost, setExpertCost] = useState<number>(initialData?.expertCost || 0);

    // Allocation Inputs (Revenue base for calculation)
    const [group185, setGroup185] = useState<number>(initialData?.group185 || 0);
    const [group25, setGroup25] = useState<number>(initialData?.group25 || 0);
    const [groupOther, setGroupOther] = useState<number>(initialData?.groupOther || 0);

    // --- Calculations ---
    const totalRevenue = useMemo(() => items.reduce((sum, item) => sum + (item.quantity * item.sellPrice), 0), [items]);
    const totalInputCost = useMemo(() => items.reduce((sum, item) => sum + (item.quantity * item.costPrice), 0), [items]);

    const expertSupportCost = expertCost * 0.3;
    const totalDynamicCosts = useMemo(() => dynamicCosts.reduce((sum, cost) => sum + cost.amount, 0), [dynamicCosts]);
    const totalCosts = totalInputCost + totalDynamicCosts + expertCost + expertSupportCost;

    const grossProfit = totalRevenue - totalCosts;
    const profitMargin = totalRevenue > 0 ? (grossProfit / totalRevenue) * 100 : 0;

    // Lợi nhuận công ty thu về (I)
    const companyProfit = (group185 * 0.185) + (group25 * 0.25) + groupOther;
    // Lợi nhuận để lại Chi nhánh (K = G - I)
    const branchProfit = grossProfit - companyProfit;

    const formatCurrency = (val: number) => new Intl.NumberFormat('vi-VN').format(val || 0) + ' ₫';

    // Handlers
    const handleAddItem = () => {
        setItems([...items, { id: Date.now().toString(), name: '', quantity: 1, sellPrice: 0, costPrice: 0 }]);
    };

    const handleRemoveItem = (id: string) => {
        if (items.length === 1) return;
        setItems(items.filter(item => item.id !== id));
    };

    const handleItemChange = (id: string, field: keyof PAKDLineItem, value: any) => {
        setItems(items.map(item => item.id === id ? { ...item, [field]: value } : item));
    };

    const handleAddDynamicCost = () => {
        setDynamicCosts([...dynamicCosts, { id: Date.now().toString(), name: 'Chi phí mới', amount: 0 }]);
    };

    const handleRemoveDynamicCost = (id: string) => {
        setDynamicCosts(dynamicCosts.filter(c => c.id !== id));
    };

    const handleDynamicCostChange = (id: string, field: 'name' | 'amount', value: any) => {
        setDynamicCosts(dynamicCosts.map(c => c.id === id ? { ...c, [field]: value } : c));
    };

    const searchCustomers = async (query: string) => {
        setSearchCustomerText(query);
        const results = await CustomerService.search(query);
        return results.map(c => ({ id: c.id, name: c.name, subText: c.shortName || '' }));
    };

    const handleSaveData = async () => {
        if (!customerName && !customerId) {
            toast.error('Vui lòng nhập Khách hàng trước khi lưu PAKD!');
            return;
        }

        try {
            const record: PAKDRecord = {
                id: initialData?.id || Date.now().toString(),
                code: initialData?.code || '',
                projectName,
                customerId,
                customerName,
                allocationType,
                items,
                dynamicCosts,
                expertCost,
                group185,
                group25,
                groupOther,
                totalRevenue,
                totalCosts,
                grossProfit,
                profitMargin,
                companyProfit,
                branchProfit,
                department: units.find(u => u.id === selectedUnitId)?.name || initialData?.department || '',
                creator: initialData?.creator || 'Admin',
                createdAt: initialData?.createdAt || new Date().toISOString(),
                updatedAt: new Date().toISOString()
            };

            await PAKDService.save(record);
            toast.success('Đã lưu Phương án kinh doanh thành công!');
            if (onSave) onSave();
        } catch (error) {
            console.error('Error saving PAKD:', error);
            toast.error('Có lỗi xảy ra khi lưu PAKD.');
        }
    };

    const handleExportExcel = () => {
        if (!customerName && !customerId) {
            toast.error('Vui lòng nhập Tên Khách hàng trước khi xuất file!');
            return;
        }

        try {
            // Chuẩn bị dữ liệu mảng 2 chiều (AOA) bám theo Mẫu PAKD
            const aoaData: any[][] = [
                [`Bảng phương án kinh doanh cho dự án: ${projectName}`],
                [`Khách hàng: ${customerName}`],
                [],
                ['STT', 'Tên Hàng Hóa / Dịch vụ', 'ĐVT', 'Số lượng', 'Giá bán (VNĐ)', 'Thành tiền Bán (VNĐ)', 'Giá nhập (VNĐ)', 'Thành tiền Nhập (VNĐ)', 'Lợi nhuận gộp', 'Tỷ suất (%)'],
            ];

            // 1. Dòng Sản phẩm
            items.forEach((item, index) => {
                const sellTotal = item.quantity * item.sellPrice;
                const costTotal = item.quantity * item.costPrice;
                const rowMargin = sellTotal - costTotal;
                const rowMarginPercent = sellTotal > 0 ? (rowMargin / sellTotal) : 0;

                aoaData.push([
                    index + 1,
                    item.name || 'Chưa đặt tên',
                    'Gói',
                    item.quantity,
                    item.sellPrice,
                    sellTotal,
                    item.costPrice,
                    costTotal,
                    rowMargin,
                    rowMarginPercent
                ]);
            });

            // Tổng cộng SP
            aoaData.push([
                '', 'Tổng cộng hợp đồng:', '', '', '', totalRevenue, '', totalInputCost, (totalRevenue - totalInputCost), totalRevenue > 0 ? (totalRevenue - totalInputCost) / totalRevenue : 0
            ]);

            aoaData.push([], ['TỔNG HỢP TÀI CHÍNH:', '', '', '', '', '', 'KẾ HOẠCH THANH TOÁN', '', '']);

            // Các chỉ số Bảng Tài chính
            aoaData.push(['A', 'Sản lượng hợp đồng (Doanh thu thuần)', totalRevenue]);
            aoaData.push(['B', 'Giá nhập', totalInputCost]);

            // Xử lý Dynamic Costs (C.1, C.2...)
            let rowPrefixIndex = 1;
            dynamicCosts.forEach((dc) => {
                aoaData.push([`C.${rowPrefixIndex}`, dc.name || 'Chi phí khác', dc.amount]);
                rowPrefixIndex++;
            });
            aoaData.push(['C', 'Tổng Chi phí khác', totalDynamicCosts]);

            aoaData.push(['D', 'Phí thuê chuyên gia (net)', expertCost]);
            aoaData.push(['E', 'Phí hỗ trợ chuyên gia thực hiện (D x 30%)', expertSupportCost]);
            aoaData.push(['F', 'Tổng giá mua và chi phí (B+C+D+E)', totalCosts]);
            aoaData.push(['G', 'Lợi nhuận Gộp (G=A-F)', grossProfit]);
            aoaData.push(['H', 'Hệ số LN/ DT (G/A)', profitMargin / 100]); // in Excel 0.xxx is formatted as %
            aoaData.push(['I', 'Tổng LN chuyển về công ty', companyProfit]);
            aoaData.push(['', '  - Nhóm SP theo tỷ lệ 18,5%', group185 * 0.185]);
            aoaData.push(['', '  - Nhóm SP theo tỷ lệ 25%', group25 * 0.25]);
            aoaData.push(['', '  - Nhóm SP theo tỷ lệ Khác', groupOther]);
            aoaData.push(['K', 'LN để lại Đơn vị (=G-I)', branchProfit]);

            // Create Workbook
            const wb = xlsx.utils.book_new();
            const ws = xlsx.utils.aoa_to_sheet(aoaData);

            // Căn chỉnh cơ bản độ rộng cột
            ws['!cols'] = [
                { wch: 5 },  // STT
                { wch: 45 }, // Tên
                { wch: 10 }, // ĐVT
                { wch: 10 }, // Số lượng
                { wch: 15 }, // Giá bán
                { wch: 20 }, // Thành tiền bán
                { wch: 15 }, // Giá nhập
                { wch: 20 }, // Thành tiền nhập
                { wch: 15 }, // LN
                { wch: 10 }, // %
            ];

            xlsx.utils.book_append_sheet(wb, ws, 'PAKD');
            xlsx.writeFile(wb, `PAKD_${customerName.replace(/[^a-z0-9]/gi, '_')}.xlsx`);

            toast.success('Xuất file Excel thành công!');
        } catch (error) {
            console.error('Export Error:', error);
            toast.error('Có lỗi xảy ra khi tạo file Excel.');
        }
    };

    return (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-sm flex flex-col xl:flex-row h-full">
            {/* Cột trái: Form Nhập Liệu */}
            <div className="w-full xl:w-3/4 border-r border-slate-200 dark:border-slate-800 flex flex-col bg-white dark:bg-slate-900">
                <div className="p-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        {onCancel && (
                            <button onClick={onCancel} className="p-2 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors" title="Quay lại danh sách">
                                <ArrowLeft size={18} />
                            </button>
                        )}
                        <h3 className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
                            <Calculator size={18} className="text-orange-500" />
                            Nhập liệu Phương án Kinh doanh
                        </h3>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-8">
                    {/* Phần 1: Thông tin dự án */}
                    <div className="space-y-4">
                        <h4 className="text-sm font-semibold text-slate-900 dark:text-white uppercase tracking-wider">I. Thông tin chung</h4>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div className="relative">
                                <SearchableSelect
                                    label="Khách hàng"
                                    value={customerId}
                                    onChange={(id, option) => {
                                        setCustomerId(id);
                                        if (option) setCustomerName(option.name);
                                    }}
                                    onSearch={async (q) => {
                                        setSearchCustomerText(q);
                                        const res = await CustomerService.search(q);
                                        // Lưu lại name cho nút Export dễ truy xuất
                                        return res.map(c => ({ id: c.id, name: c.name, subText: c.taxCode || c.phone || '' }));
                                    }}
                                    getDisplayValue={(id) => customerId === id ? customerName : undefined}
                                    placeholder="Tìm kiếm khách hàng..."
                                    onAddNew={() => setIsAddCustomerOpen(true)}
                                    addNewLabel="+ Thêm Khách hàng"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-slate-500 dark:text-slate-400 mb-1.5">Tên Hợp đồng / Dự án</label>
                                <input value={projectName} onChange={e => setProjectName(e.target.value)} type="text" className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-800 rounded-lg text-sm font-medium focus:border-indigo-500 outline-none transition-all text-slate-900 dark:text-white" placeholder="Mua bán bản quyền..." />
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-slate-500 dark:text-slate-400 mb-1.5">Đơn vị lập</label>
                                <select
                                    value={selectedUnitId}
                                    onChange={e => {
                                        const unitId = e.target.value;
                                        setSelectedUnitId(unitId);
                                        const unit = units.find(u => u.id === unitId);
                                        if (unit) {
                                            setAllocationType(unit.type === 'Branch' ? 'branch' : 'unit');
                                        }
                                    }}
                                    className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm font-medium focus:border-indigo-500 outline-none transition-all text-slate-900 dark:text-white appearance-none cursor-pointer"
                                >
                                    <option value="">-- Chọn đơn vị --</option>
                                    {units.filter(u => u.type === 'Center' || u.type === 'Branch').map(u => (
                                        <option key={u.id} value={u.id}>
                                            {u.name}{u.type === 'Branch' ? ' (Chi nhánh)' : ''}
                                        </option>
                                    ))}
                                </select>
                                {selectedUnitId && (
                                    <p className="text-xs mt-1 text-slate-400 dark:text-slate-500">
                                        Loại hình: {allocationType === 'branch' ? '🏢 Chi nhánh — Có cơ chế phân chia LN' : '🏛️ Đơn vị (Phòng/Ban)'}
                                    </p>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Phần 2: Sản lượng (Bán ra) */}
                    <div className="space-y-4">
                        <div className="flex items-center justify-between">
                            <h4 className="text-sm font-semibold text-slate-900 dark:text-white uppercase tracking-wider">II. Sản lượng Báo giá & Đầu vào</h4>
                            <button onClick={handleAddItem} className="text-sm text-orange-600 dark:text-orange-400 font-medium hover:bg-orange-50 dark:hover:bg-orange-900/20 px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1">
                                <Plus size={16} /> Thêm Sản phẩm
                            </button>
                        </div>
                        <div className="border border-slate-200 dark:border-slate-700 rounded-lg overflow-visible">
                            <table className="w-full text-sm text-left whitespace-nowrap">
                                <thead className="bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-b border-slate-200 dark:border-slate-700">
                                    <tr>
                                        <th className="px-2 py-2 font-medium min-w-[200px]">Sản phẩm / Dịch vụ</th>
                                        <th className="px-2 py-2 font-medium w-20">SL</th>
                                        <th className="px-2 py-2 font-medium w-28">Giá Bán</th>
                                        <th className="px-2 py-2 font-medium w-28">Giá Vốn</th>
                                        <th className="px-2 py-2 font-medium w-10 pt-2"></th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {items.map(item => (
                                        <tr key={item.id} className="border-b border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
                                            <td className="px-2 py-2">
                                                <div className="w-full min-w-[250px]">
                                                    <SearchableSelect
                                                        value={item.productId || null}
                                                        onChange={(prodId, option) => {
                                                            if (!prodId) return;

                                                            if (option) {
                                                                const rawItems = [...items];
                                                                const targetIndex = rawItems.findIndex(i => i.id === item.id);
                                                                if (targetIndex > -1) {
                                                                    rawItems[targetIndex] = { ...rawItems[targetIndex], productId: prodId, name: option.name };
                                                                    setItems(rawItems);
                                                                }
                                                            }

                                                            ProductService.getById(prodId).then(prd => {
                                                                if (prd) {
                                                                    setItems(currentItems => currentItems.map(i =>
                                                                        i.id === item.id ? { ...i, productId: prodId, name: prd.name, sellPrice: prd.basePrice || 0, costPrice: prd.costPrice || 0 } : i
                                                                    ));
                                                                }
                                                            }).catch(console.error);
                                                        }}
                                                        onSearch={async (q) => {
                                                            setSearchProductText(q);
                                                            const res = await ProductService.search(q);
                                                            return res.map(p => ({ id: p.id, name: p.name, subText: `Bán: ${new Intl.NumberFormat('vi-VN').format(p.basePrice || 0)}đ | Vốn: ${new Intl.NumberFormat('vi-VN').format(p.costPrice || 0)}đ` }));
                                                        }}
                                                        getDisplayValue={(id) => item.productId === id ? item.name : undefined}
                                                        size="sm"
                                                        placeholder="Tìm hoặc nhập tên..."
                                                        onAddNew={() => {
                                                            setAddingProductToItemId(item.id);
                                                            setIsAddProductOpen(true);
                                                        }}
                                                        addNewLabel="+ Hàng hóa mới"
                                                    />
                                                </div>
                                            </td>
                                            <td className="px-1 py-1">
                                                <input value={item.quantity || ''} onChange={e => handleItemChange(item.id, 'quantity', Number(e.target.value))} type="number" className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded px-2 py-1.5 text-xs font-semibold text-slate-900 dark:text-white focus:ring-2 focus:ring-orange-500" placeholder="1" />
                                            </td>
                                            <td className="px-1 py-1">
                                                <input value={item.sellPrice || ''} onChange={e => handleItemChange(item.id, 'sellPrice', Number(e.target.value))} type="number" className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded px-2 py-1.5 text-xs font-semibold text-slate-900 dark:text-white focus:ring-2 focus:ring-orange-500" placeholder="0" />
                                            </td>
                                            <td className="px-1 py-1">
                                                <input value={item.costPrice || ''} onChange={e => handleItemChange(item.id, 'costPrice', Number(e.target.value))} type="number" className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded px-2 py-1.5 text-xs font-semibold text-slate-900 dark:text-white focus:ring-2 focus:ring-orange-500" placeholder="0" />
                                            </td>
                                            <td className="px-2 py-2 text-right">
                                                <button onClick={() => handleRemoveItem(item.id)} className="text-slate-400 dark:text-slate-500 hover:text-red-500 dark:hover:text-red-400 p-1 transition-colors"><Trash2 size={16} /></button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* Phần 3: Chi phí và Quy định phân chia */}
                    <div className="pt-4 border-t border-slate-200 dark:border-slate-800 space-y-4">
                        <h4 className="text-sm font-semibold text-slate-900 dark:text-white uppercase tracking-wider">III. Chi phí & Cơ chế Phân chia LN</h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-3 p-4 bg-slate-50 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700">
                                {/* Mảng chi phí tuỳ chọn */}
                                <div className="space-y-3">
                                    <div className="flex items-center justify-between">
                                        <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase">Mục Chi phí khác</label>
                                        <button onClick={handleAddDynamicCost} className="text-[10px] text-indigo-600 dark:text-indigo-400 font-bold hover:bg-indigo-50 dark:hover:bg-indigo-900/30 px-2 py-1 rounded transition-colors flex items-center gap-1">
                                            <Plus size={12} /> Thêm phí
                                        </button>
                                    </div>
                                    {dynamicCosts.map((cost) => (
                                        <div key={cost.id} className="flex items-end gap-2">
                                            <div className="flex-1">
                                                <input value={cost.name} onChange={e => handleDynamicCostChange(cost.id, 'name', e.target.value)} type="text" className="w-full px-3 py-2 bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg text-xs font-medium text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none" placeholder="Tên loại phí (VD: Thuế, Tiếp khách)..." />
                                            </div>
                                            <div className="flex-1">
                                                <input value={cost.amount || ''} onChange={e => handleDynamicCostChange(cost.id, 'amount', Number(e.target.value))} type="number" className="w-full px-3 py-2 bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg text-sm font-bold text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none" placeholder="0" />
                                            </div>
                                            <div className="pb-1">
                                                <button onClick={() => handleRemoveDynamicCost(cost.id)} className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors">
                                                    <Trash2 size={16} />
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                                <hr className="border-slate-200 dark:border-slate-700" />
                                <div className="grid grid-cols-2 gap-3 pt-1">
                                    <div>
                                        <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Thuê chuyên gia gốc</label>
                                        <input value={expertCost || ''} onChange={e => setExpertCost(Number(e.target.value))} type="number" className="w-full px-3 py-2 bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-orange-500" placeholder="0" />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Phí HD thầu (mặc định 30%)</label>
                                        <input value={expertSupportCost || ''} readOnly type="number" className="w-full px-3 py-2 bg-slate-100 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-sm text-slate-500 dark:text-slate-400 cursor-not-allowed" placeholder="0" />
                                    </div>
                                </div>
                            </div>

                            {allocationType === 'branch' && (
                                <div className="space-y-3 p-4 bg-slate-50 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700">
                                    <div>
                                        <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Sản lượng cho Nhóm tỷ lệ 18.5%</label>
                                        <input value={group185 || ''} onChange={e => setGroup185(Number(e.target.value))} type="number" className="w-full px-3 py-2 bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-orange-500" placeholder="0" />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Sản lượng cho Nhóm tỷ lệ 25%</label>
                                        <input value={group25 || ''} onChange={e => setGroup25(Number(e.target.value))} type="number" className="w-full px-3 py-2 bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-orange-500" placeholder="0" />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">LN chuyển thêm về CTy (Cơ chế khác)</label>
                                        <input value={groupOther || ''} onChange={e => setGroupOther(Number(e.target.value))} type="number" className="w-full px-3 py-2 bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-orange-500" placeholder="0" />
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Cột phải: Preview Kết quả & Nút tải Excel */}
            <div className="w-full xl:w-1/4 bg-slate-50 dark:bg-slate-800 flex flex-col relative border-t xl:border-t-0 border-slate-200 dark:border-slate-700">
                <div className="p-4 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center bg-slate-50 dark:bg-slate-800">
                    <div>
                        <h3 className="font-bold text-slate-900 dark:text-white">Tổng hợp Tài chính</h3>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Tính toán theo Doanh thu chưa Thuế</p>
                    </div>
                </div>

                <div className="flex-1 p-4 sm:p-6 space-y-6 overflow-y-auto">
                    <div className="space-y-4">
                        <div className="p-4 bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700">
                            <h4 className="text-sm font-semibold text-slate-800 dark:text-slate-200 mb-4 flex items-center gap-2">
                                <Activity size={16} className="text-blue-500" />
                                Lợi nhuận cấp Công ty
                            </h4>
                            <div className="space-y-3">
                                <div className="flex justify-between items-center text-sm">
                                    <span className="text-slate-600 dark:text-slate-400">Doanh thu Thuần:</span>
                                    <span className="font-semibold text-slate-900 dark:text-white">{formatCurrency(totalRevenue)}</span>
                                </div>
                                <div className="flex justify-between items-center text-sm">
                                    <span className="text-slate-600 dark:text-slate-400">Tổng Vốn & Chi phí:</span>
                                    <span className="font-semibold text-rose-600 dark:text-rose-400">{formatCurrency(totalCosts)}</span>
                                </div>
                                <div className="h-px bg-slate-200 dark:bg-slate-700 w-full"></div>
                                <div className="flex justify-between items-center text-base">
                                    <span className="font-bold text-slate-700 dark:text-slate-300">Lợi nhuận gộp Dự án:</span>
                                    <span className="font-bold text-emerald-600 dark:text-emerald-400">{formatCurrency(grossProfit)}</span>
                                </div>
                                <div className="flex justify-between items-center text-sm mt-1 mb-4">
                                    <span className="text-slate-500 dark:text-slate-400">Tỷ suất LN/DT:</span>
                                    <span className="font-medium text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-900/50 bg-indigo-50 dark:bg-indigo-900/20 px-2 py-0.5 rounded">{profitMargin.toFixed(2)}%</span>
                                </div>
                            </div>
                        </div>

                        {allocationType === 'branch' && (
                            <div className="p-4 bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700">
                                <h4 className="text-sm font-semibold text-slate-800 dark:text-slate-200 mb-4 flex items-center gap-2">
                                    <Calculator size={16} className="text-orange-500" />
                                    Phân bổ Lợi nhuận
                                </h4>
                                <div className="space-y-3">
                                    <div className="flex justify-between items-center text-sm">
                                        <span className="text-slate-600 dark:text-slate-400">Chuyển về Công ty (I):</span>
                                        <span className="font-semibold text-sky-600 dark:text-sky-400">{formatCurrency(companyProfit)}</span>
                                    </div>
                                    <div className="flex justify-between items-center text-sm">
                                        <span className="text-slate-600 dark:text-slate-400">LN để lại Đơn vị (K):</span>
                                        <span className="font-semibold text-indigo-600 dark:text-indigo-400">{formatCurrency(branchProfit)}</span>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Actions Bottom */}
                <div className="p-4 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 space-y-3">
                    <button onClick={handleExportExcel} className="w-full py-3 px-4 bg-[#107c41] hover:bg-[#185c37] text-white rounded-lg font-semibold flex justify-center items-center gap-2 transition-all shadow-md shadow-green-600/20">
                        <Download size={18} /> Điền Xuất File Excel Nhanh
                    </button>
                    <button onClick={handleSaveData} className="w-full py-3 px-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-semibold flex justify-center items-center gap-2 transition-all shadow-md shadow-indigo-600/20">
                        Lưu Phương án
                    </button>
                    {onCancel && (
                        <button onClick={onCancel} className="w-full py-3 px-4 bg-slate-200 hover:bg-slate-300 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-800 dark:text-slate-200 rounded-lg font-semibold flex justify-center items-center gap-2 transition-all">
                            Hủy Bỏ / Quay Lại
                        </button>
                    )}
                    <button
                        onClick={() => toast.info('Tính năng đang được phát triển')}
                        className="w-full py-3 px-4 bg-orange-500 hover:bg-orange-600 text-white rounded-lg font-semibold flex justify-center items-center gap-2 transition-all shadow-md shadow-orange-500/20">
                        Tạo Hợp Đồng từ PAKD <ArrowRight size={18} />
                    </button>
                    <p className="text-xs text-center text-slate-400 dark:text-slate-500">Mẫu được tham chiếu: PAKD QĐ09/2024</p>
                </div>
            </div>

            {/* Render Dialogs */}
            <QuickAddCustomerDialog
                isOpen={isAddCustomerOpen}
                onClose={() => setIsAddCustomerOpen(false)}
                initialName={searchCustomerText}
                onCreated={(newCustomer) => {
                    setCustomerId(newCustomer.id);
                    // Có thể thiết lập lại tên khách hàng phụ trợ ở đây nếu cần thiết
                }}
            />

            <QuickAddProductDialog
                isOpen={isAddProductOpen}
                onClose={() => {
                    setIsAddProductOpen(false);
                    setAddingProductToItemId(null);
                }}
                initialName={searchProductText}
                onCreated={(newProduct) => {
                    if (addingProductToItemId) {
                        const rawItems = [...items];
                        const targetIndex = rawItems.findIndex(i => i.id === addingProductToItemId);
                        if (targetIndex > -1) {
                            rawItems[targetIndex] = { ...rawItems[targetIndex], name: newProduct.name, sellPrice: newProduct.basePrice || 0, costPrice: newProduct.costPrice || 0 };
                            setItems(rawItems);
                        }
                    }
                    setIsAddProductOpen(false);
                }}
            />
        </div>
    );
};

export default PAKDGenerator;
