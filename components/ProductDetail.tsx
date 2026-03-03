import React, { useState, useEffect, useMemo } from 'react';
import { toast } from 'sonner';
import {
    ArrowLeft,
    Package,
    Tag,
    FileText,
    TrendingUp,
    CheckCircle,
    XCircle,
    Hash,
    Loader2,
    Edit3,
    Trash2
} from 'lucide-react';
import { Product, Unit, Contract, Customer, Brand } from '../types';
import { ProductService, UnitService, ContractService, CustomerService, BrandService } from '../services';
import { usePermissionCheck } from '../hooks/usePermissions';

interface ProductDetailProps {
    productId: string;
    onBack: () => void;
    onEdit: () => void;
    onViewContract?: (id: string) => void;
}

const ProductDetail: React.FC<ProductDetailProps> = ({ productId, onBack, onEdit, onViewContract }) => {
    const { can } = usePermissionCheck();
    const allowDelete = can('products', 'delete');

    const [product, setProduct] = useState<Product | null>(null);
    const [unit, setUnit] = useState<Unit | null>(null);
    const [relatedContracts, setRelatedContracts] = useState<Contract[]>([]);
    const [customers, setCustomers] = useState<Customer[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const fetchData = async () => {
            setIsLoading(true);
            try {
                // 1. Fetch Product first
                const productData = await ProductService.getById(productId);
                if (!productData) {
                    setIsLoading(false);
                    return;
                }
                setProduct(productData);

                // 2. Parallel Fetch: Unit, Related Contracts (Server-side), Customers
                const requests: Promise<any>[] = [];

                if (productData.unitId) {
                    requests.push(UnitService.getById(productData.unitId));
                } else {
                    requests.push(Promise.resolve(null));
                }

                // Server-side filtering for related contracts (limit 20 for performance)
                // Using category and product name as heuristics
                requests.push(ContractService.getRelated(productData.category, productData.name, 50));

                // Fetch all customers for mapping (Optimizable: fetch only related customers)
                requests.push(CustomerService.getAll());

                const [unitData, related, customerRes] = await Promise.all(requests);

                setUnit(unitData || null);
                setRelatedContracts(related || []);
                setCustomers(customerRes?.data || []);

            } catch (error) {
                console.error("Error fetching product details:", error);
            } finally {
                setIsLoading(false);
            }
        };

        fetchData();
    }, [productId]);

    const formatCurrency = (val: number) => {
        return (val || 0).toLocaleString('vi-VN') + ' ₫';
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-full min-h-[400px]">
                <Loader2 size={32} className="animate-spin text-indigo-500" />
            </div>
        );
    }

    if (!product) {
        return (
            <div className="flex flex-col items-center justify-center h-full py-12">
                <p className="text-slate-500 mb-4">Không tìm thấy sản phẩm</p>
                <button onClick={onBack} className="text-indigo-600 font-bold hover:underline">Quay lại</button>
            </div>
        );
    }

    const margin = product.basePrice && product.costPrice
        ? ((product.basePrice - product.costPrice) / product.basePrice * 100).toFixed(0)
        : 0;

    const stats = {
        contractCount: relatedContracts.length,
        totalValue: relatedContracts.reduce((sum, c) => sum + c.value, 0),
        totalRevenue: relatedContracts.reduce((sum, c) => sum + c.actualRevenue, 0),
        activeContracts: relatedContracts.filter(c => c.status === 'Processing').length
    };

    return (
        <div className="space-y-6 animate-in slide-in-from-right-4 duration-500 pb-12">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                    <button
                        onClick={onBack}
                        className="p-2 hover:bg-white dark:hover:bg-slate-800 rounded-lg border border-transparent hover:border-slate-200 dark:hover:border-slate-700 transition-all text-slate-500"
                    >
                        <ArrowLeft size={20} />
                    </button>
                    <div>
                        <div className="flex items-center gap-2 mb-1">
                            <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/30 px-2 py-0.5 rounded uppercase tracking-wider">
                                {product.code}
                            </span>
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border uppercase ${product.isActive
                                ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 border-emerald-200'
                                : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 border-slate-200'
                                }`}>
                                {product.isActive ? 'Đang kinh doanh' : 'Ngừng kinh doanh'}
                            </span>
                        </div>
                        <h1 className="text-xl md:text-2xl font-bold text-slate-900 dark:text-slate-100 leading-tight">{product.name}</h1>
                    </div>
                </div>
                <div className="flex gap-2">
                    <button
                        onClick={onEdit}
                        className="flex items-center justify-center gap-2 px-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-800 rounded-lg text-sm font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-all"
                    >
                        <Edit3 size={16} />
                        Chỉnh sửa
                    </button>
                    {allowDelete && (
                        <button
                            onClick={async () => {
                                if (confirm('Bạn có chắc chắn muốn xóa sản phẩm này? hành động này không thể hoàn tác.')) {
                                    try {
                                        await ProductService.delete(productId);
                                        toast.success("Đã xóa sản phẩm thành công");
                                        onBack();
                                    } catch (error) {
                                        console.error('Failed to delete product', error);
                                        toast.error('Có lỗi xảy ra khi xóa sản phẩm');
                                    }
                                }
                            }}
                            className="flex items-center justify-center gap-2 px-4 py-2 bg-white dark:bg-slate-800 border border-rose-200 dark:border-rose-900/30 rounded-lg text-sm font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-900/20 transition-all"
                        >
                            <Trash2 size={16} />
                            Xóa
                        </button>
                    )}
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Main Info */}
                <div className="lg:col-span-2 space-y-6">
                    {/* Financial Summary */}
                    <div className="bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 shadow-sm p-6 md:p-8">
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                            <div className="space-y-1">
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Giá bán (Dự kiến)</p>
                                <p className="text-2xl font-black text-slate-900 dark:text-slate-100">
                                    {formatCurrency(product.basePrice)}
                                </p>
                                <p className="text-[10px] text-slate-400">/{product.unit}</p>
                            </div>
                            <div className="space-y-1">
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Giá vốn (Ước tính)</p>
                                <p className="text-2xl font-black text-slate-600 dark:text-slate-300">
                                    {formatCurrency(product.costPrice || 0)}
                                </p>
                                <p className="text-[10px] text-slate-400">/{product.unit}</p>
                            </div>
                            <div className="space-y-1">
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Biên lợi nhuận</p>
                                <p className="text-2xl font-black text-emerald-600 dark:text-emerald-400">
                                    {margin}%
                                </p>
                            </div>
                            <div className="space-y-1">
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Đơn vị phụ trách</p>
                                <p className="text-lg font-bold text-indigo-600 dark:text-indigo-400">
                                    {unit?.name || 'Chưa phân công'}
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Description */}
                    <div className="bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 shadow-sm p-6 md:p-8">
                        <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100 mb-4 flex items-center gap-2">
                            <FileText size={20} className="text-indigo-600 dark:text-indigo-400" />
                            Mô tả sản phẩm/dịch vụ
                        </h3>
                        <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                            {product.description || 'Chưa có mô tả.'}
                        </p>
                    </div>

                    {/* Related Contracts */}
                    <div className="bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
                        <div className="p-6 border-b border-slate-100 dark:border-slate-800">
                            <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                                <TrendingUp size={20} className="text-indigo-600 dark:text-indigo-400" />
                                Hợp đồng liên quan ({stats.contractCount})
                            </h3>
                        </div>
                        {relatedContracts.length > 0 ? (
                            <div className="divide-y divide-slate-100 dark:divide-slate-800">
                                {relatedContracts.map(contract => {
                                    const customer = customers.find(c => c.id === contract.customerId);
                                    return (
                                        <div
                                            key={contract.id}
                                            onClick={() => onViewContract?.(contract.id)}
                                            className="p-4 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors cursor-pointer"
                                        >
                                            <div className="flex justify-between items-start">
                                                <div className="min-w-0 pr-4">
                                                    <div className="flex items-center gap-2 mb-1">
                                                        <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400">{contract.id.slice(0, 8)}...</span>
                                                        <span className={`text-[9px] font-bold px-2 py-0.5 rounded uppercase ${contract.status === 'Processing'
                                                            ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                                                            : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
                                                            }`}>
                                                            {contract.status}
                                                        </span>
                                                    </div>
                                                    <p className="text-sm font-medium text-slate-700 dark:text-slate-300 truncate">{contract.title}</p>
                                                    <p className="text-xs text-slate-400 mt-0.5">{customer?.shortName || contract.partyA}</p>
                                                </div>
                                                <div className="text-right shrink-0">
                                                    <p className="text-xs text-slate-400 mb-0.5">{contract.signedDate}</p>
                                                    <p className="text-sm font-black text-slate-900 dark:text-slate-100">{formatCurrency(contract.value)}</p>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        ) : (
                            <div className="p-8 text-center text-sm text-slate-500 dark:text-slate-400">
                                Chưa tìm thấy hợp đồng nào liên quan đến sản phẩm này.
                            </div>
                        )}
                    </div>
                </div>

                {/* Side Info */}
                <div className="space-y-6">
                    {/* Product Card */}
                    <div className="bg-gradient-to-br from-indigo-600 to-purple-700 rounded-lg p-6 text-white shadow-xl shadow-indigo-200 dark:shadow-none">
                        <div className="w-14 h-14 bg-white/20 rounded-lg flex items-center justify-center mb-4">
                            <Package size={28} />
                        </div>
                        <h4 className="text-lg font-bold mb-2">{product.name}</h4>
                        <div className="space-y-2 text-sm text-indigo-100">
                            <div className="flex items-center gap-2">
                                <Tag size={14} />
                                <span>{product.category}</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <Hash size={14} />
                                <span>Đơn vị: {product.unit}</span>
                            </div>
                            {product.brandName && (
                                <div className="flex items-center gap-2">
                                    <Tag size={14} />
                                    <span>Hãng: {product.brandName}</span>
                                </div>
                            )}
                            {product.supplierName && (
                                <div className="flex items-center gap-2">
                                    <Tag size={14} />
                                    <span>NCC: {product.supplierName}</span>
                                </div>
                            )}
                            {product.sku && (
                                <div className="flex items-center gap-2">
                                    <Hash size={14} />
                                    <span>SKU: {product.sku}</span>
                                </div>
                            )}
                            {product.model && (
                                <div className="flex items-center gap-2">
                                    <Hash size={14} />
                                    <span>Model: {product.model}</span>
                                </div>
                            )}
                            {product.warrantyMonths && product.warrantyMonths > 0 && (
                                <div className="flex items-center gap-2">
                                    <CheckCircle size={14} />
                                    <span>BH: {product.warrantyMonths} tháng</span>
                                </div>
                            )}
                            <div className="flex items-center gap-2">
                                {product.isActive ? <CheckCircle size={14} /> : <XCircle size={14} />}
                                <span>{product.isActive ? 'Đang kinh doanh' : 'Ngừng'}</span>
                            </div>
                        </div>
                    </div>

                    {/* Quick Stats */}
                    <div className="bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 shadow-sm p-6">
                        <h4 className="font-bold text-slate-800 dark:text-slate-200 mb-4 flex items-center gap-2">
                            <TrendingUp size={18} className="text-slate-400" />
                            Thống kê (Top 50 HĐ liên quan)
                        </h4>
                        <div className="space-y-4">
                            <div className="flex justify-between items-center">
                                <span className="text-xs text-slate-500">Số hợp đồng</span>
                                <span className="text-sm font-black text-slate-900 dark:text-slate-100">{stats.contractCount}</span>
                            </div>
                            <div className="flex justify-between items-center">
                                <span className="text-xs text-slate-500">Tổng giá trị HĐ</span>
                                <span className="text-sm font-black text-indigo-600 dark:text-indigo-400">
                                    {formatCurrency(stats.totalValue)}
                                </span>
                            </div>
                            <div className="flex justify-between items-center">
                                <span className="text-xs text-slate-500">Doanh thu thực tế</span>
                                <span className="text-sm font-black text-emerald-600 dark:text-emerald-400">
                                    {formatCurrency(stats.totalRevenue)}
                                </span>
                            </div>
                            <div className="flex justify-between items-center">
                                <span className="text-xs text-slate-500">HĐ đang thực hiện</span>
                                <span className="text-sm font-black text-indigo-600 dark:text-indigo-400">
                                    {stats.activeContracts}
                                </span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ProductDetail;
