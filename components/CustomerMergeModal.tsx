import React, { useState, useEffect } from 'react';
import { X, GitMerge, Search, Check, AlertTriangle, Loader2 } from 'lucide-react';
import { Customer } from '../types';
import { CustomerService } from '../services';
import { toast } from 'sonner';

interface CustomerMergeModalProps {
    isOpen: boolean;
    onClose: () => void;
    sourceCustomer: Customer;
    onMerged: () => void;
}

const CustomerMergeModal: React.FC<CustomerMergeModalProps> = ({ isOpen, onClose, sourceCustomer, onMerged }) => {
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState<Customer[]>([]);
    const [isSearching, setIsSearching] = useState(false);
    const [targetCustomer, setTargetCustomer] = useState<Customer | null>(null);
    const [isMerging, setIsMerging] = useState(false);

    useEffect(() => {
        if (!isOpen) {
            setSearchQuery('');
            setSearchResults([]);
            setTargetCustomer(null);
            setIsMerging(false);
        }
    }, [isOpen]);

    useEffect(() => {
        const timer = setTimeout(async () => {
            if (searchQuery.trim().length < 2) {
                setSearchResults([]);
                return;
            }
            setIsSearching(true);
            try {
                const res = await CustomerService.getAll({
                    page: 1,
                    pageSize: 10,
                    search: searchQuery
                });
                // Exclude the source customer from results
                setSearchResults(res.data.filter(c => c.id !== sourceCustomer.id));
            } catch (err) {
                console.error("Lỗi tìm khách hàng", err);
            } finally {
                setIsSearching(false);
            }
        }, 500);
        return () => clearTimeout(timer);
    }, [searchQuery, sourceCustomer.id]);

    if (!isOpen) return null;

    const handleMerge = async () => {
        if (!targetCustomer) return;
        
        if (!confirm(`XÁC NHẬN GỘP: Bạn chuẩn bị gộp toàn bộ dữ liệu của [${sourceCustomer.name}] vào [${targetCustomer.name}]. Dữ liệu nguồn sẽ bị xóa. Hành động này không thể hoàn tác!`)) {
            return;
        }

        setIsMerging(true);
        try {
            await CustomerService.mergePartners(sourceCustomer.id, targetCustomer.id);
            toast.success("Gộp đối tác thành công!");
            onMerged();
            onClose();
        } catch (e: any) {
            toast.error("Lỗi khi gộp đối tác: " + e.message);
        } finally {
            setIsMerging(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white dark:bg-slate-900 rounded-xl w-full max-w-2xl shadow-2xl flex flex-col max-h-[90vh]">
                <div className="p-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
                    <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                        <GitMerge size={20} className="text-indigo-500" />
                        Gộp Đối Tác (Merge)
                    </h2>
                    <button onClick={onClose} className="p-2 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg">
                        <X size={20} />
                    </button>
                </div>
                
                <div className="p-5 overflow-y-auto flex-1 space-y-5">
                    {/* Source Customer Warning */}
                    <div className="bg-rose-50 dark:bg-rose-900/20 border border-rose-200 dark:border-rose-900/50 rounded-lg p-4">
                        <div className="flex gap-3">
                            <AlertTriangle size={20} className="text-rose-600 dark:text-rose-400 shrink-0" />
                            <div>
                                <h3 className="font-bold text-rose-800 dark:text-rose-300 text-sm">Đối tác gốc (Sẽ bị xóa)</h3>
                                <p className="text-rose-700 dark:text-rose-400 font-medium mt-1">{sourceCustomer.name}</p>
                                {sourceCustomer.taxCode && <p className="text-xs text-rose-600/70 dark:text-rose-400/70">MST: {sourceCustomer.taxCode}</p>}
                                <p className="text-xs text-rose-600/70 dark:text-rose-400/70 mt-1">Toàn bộ hợp đồng, thanh toán và liên hệ sẽ được dời sang đối tác đích.</p>
                            </div>
                        </div>
                    </div>

                    {/* Target Customer Selection */}
                    <div>
                        <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">Tìm Đối tác đích (Giữ lại)</label>
                        <div className="relative">
                            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                            <input
                                type="text"
                                placeholder="Nhập tên hoặc MST..."
                                value={searchQuery}
                                onChange={(e) => {
                                    setSearchQuery(e.target.value);
                                    setTargetCustomer(null); // Reset choice on new search
                                }}
                                className="w-full pl-9 pr-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                            />
                            {isSearching && <Loader2 size={16} className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-slate-400" />}
                        </div>

                        {/* Search Results Dropdown */}
                        {searchQuery.length >= 2 && !targetCustomer && (
                            <div className="mt-2 border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden bg-white dark:bg-slate-900 shadow-md">
                                {searchResults.length === 0 && !isSearching ? (
                                    <div className="p-4 text-center text-sm text-slate-500">Không tìm thấy đối tác phù hợp.</div>
                                ) : (
                                    searchResults.map(c => (
                                        <button
                                            key={c.id}
                                            onClick={() => setTargetCustomer(c)}
                                            className="w-full text-left p-3 hover:bg-slate-50 dark:hover:bg-slate-800 border-b border-slate-100 dark:border-slate-800 last:border-0 transition-colors"
                                        >
                                            <p className="font-bold text-sm text-slate-900 dark:text-slate-100">{c.name}</p>
                                            <div className="flex gap-3 mt-1 text-xs text-slate-500">
                                                {c.taxCode && <span>MST: {c.taxCode}</span>}
                                                {c.phone && <span>SĐT: {c.phone}</span>}
                                            </div>
                                        </button>
                                    ))
                                )}
                            </div>
                        )}

                        {/* Selected Target Customer */}
                        {targetCustomer && (
                            <div className="mt-3 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-900/50 rounded-lg p-4 flex justify-between items-center">
                                <div>
                                    <h3 className="font-bold text-emerald-800 dark:text-emerald-300 text-sm">Đối tác đích (Được giữ lại)</h3>
                                    <p className="text-emerald-700 dark:text-emerald-400 font-medium mt-1">{targetCustomer.name}</p>
                                    {targetCustomer.taxCode && <p className="text-xs text-emerald-600/70 dark:text-emerald-400/70">MST: {targetCustomer.taxCode}</p>}
                                </div>
                                <button onClick={() => setTargetCustomer(null)} className="p-1 hover:bg-emerald-100 dark:hover:bg-emerald-900/40 rounded text-emerald-600 dark:text-emerald-400">
                                    <X size={16} />
                                </button>
                            </div>
                        )}
                    </div>
                </div>

                <div className="p-4 border-t border-slate-200 dark:border-slate-800 flex justify-end gap-3 bg-slate-50 dark:bg-slate-800/50 rounded-b-xl">
                    <button onClick={onClose} className="px-5 py-2.5 text-sm font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg">
                        Hủy
                    </button>
                    <button 
                        onClick={handleMerge}
                        disabled={!targetCustomer || isMerging}
                        className="px-5 py-2.5 text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                    >
                        {isMerging ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
                        Thực hiện gộp
                    </button>
                </div>
            </div>
        </div>
    );
};

export default CustomerMergeModal;
