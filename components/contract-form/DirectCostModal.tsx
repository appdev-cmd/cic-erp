// Direct Cost Modal component - extracted from ContractForm
import React from 'react';
import { Plus, Trash2, Save } from 'lucide-react';
import { DirectCostDetail, LineItem } from '../../types';
import Modal from '../ui/Modal';

interface DirectCostModalProps {
    isOpen: boolean;
    onClose: () => void;
    lineItem: LineItem | null;
    tempCostDetails: DirectCostDetail[];
    setTempCostDetails: (details: DirectCostDetail[]) => void;
    onSave: () => void;
    formatVND: (val: number) => string;
}

const DirectCostModal: React.FC<DirectCostModalProps> = ({
    isOpen,
    onClose,
    lineItem,
    tempCostDetails,
    setTempCostDetails,
    onSave,
    formatVND,
}) => {
    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title="Chi tiết Chi phí Trực tiếp"
            size="lg"
        >
            <div className="space-y-4">
                <div className="bg-slate-50 dark:bg-slate-800 p-4 rounded-lg border border-slate-100 dark:border-slate-800">
                    <h4 className="text-sm font-bold text-indigo-600 mb-2">
                        {lineItem?.name
                            ? `Sản phẩm: ${lineItem.name}`
                            : 'Chi tiết chi phí'}
                    </h4>
                    <p className="text-xs text-slate-500">Thêm các khoản chi phí trực tiếp liên quan đến sản phẩm/dịch vụ này.</p>
                </div>

                <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2">
                    {tempCostDetails.map((detail, index) => (
                        <div key={index} className="flex items-center gap-3 bg-white dark:bg-slate-900 p-2 rounded-lg border border-slate-200 dark:border-slate-800 shadow-sm">
                            <input
                                type="text"
                                placeholder="Tên chi phí (VD: Tiếp khách, Vận chuyển...)"
                                value={detail.name}
                                onChange={(e) => {
                                    const newDetails = [...tempCostDetails];
                                    newDetails[index].name = e.target.value;
                                    setTempCostDetails(newDetails);
                                }}
                                className="flex-1 bg-transparent px-3 py-2 text-sm font-medium outline-none border-b border-transparent focus:border-indigo-500 transition-colors"
                                autoFocus
                            />
                            <div className="w-32 relative">
                                <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-slate-400">₫</span>
                                <input
                                    type="text"
                                    value={detail.amount ? formatVND(detail.amount) : '0'}
                                    onChange={(e) => {
                                        const raw = e.target.value.replace(/\./g, '');
                                        if (!/^\d*$/.test(raw)) return;
                                        const newDetails = [...tempCostDetails];
                                        newDetails[index].amount = Number(raw);
                                        setTempCostDetails(newDetails);
                                    }}
                                    className="w-full bg-slate-50 dark:bg-slate-800 rounded-lg px-3 pl-6 py-2 text-sm font-bold text-right outline-none focus:ring-1 focus:ring-indigo-500"
                                />
                            </div>
                            <button
                                onClick={() => {
                                    const newDetails = tempCostDetails.filter((_, i) => i !== index);
                                    setTempCostDetails(newDetails);
                                }}
                                className="p-2 text-rose-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/30 rounded-lg transition-colors"
                            >
                                <Trash2 size={16} />
                            </button>
                        </div>
                    ))}
                </div>

                <button
                    onClick={() => {
                        setTempCostDetails([...tempCostDetails, { id: Date.now().toString(), name: '', amount: 0 }]);
                    }}
                    className="w-full py-3 border border-dashed border-slate-200 dark:border-slate-800 rounded-lg text-slate-400 font-bold text-sm hover:border-indigo-500 hover:text-indigo-500 transition-all flex items-center justify-center gap-2"
                >
                    <Plus size={16} /> Thêm khoản chi phí
                </button>

                <div className="flex items-center justify-between pt-4 border-t border-slate-100 dark:border-slate-800 mt-4">
                    <div className="text-right">
                        <p className="text-xs text-slate-400 uppercase font-bold">Tổng chi phí</p>
                        <p className="text-xl font-black text-rose-500">
                            {formatVND(tempCostDetails.reduce((acc, item) => acc + item.amount, 0))}
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
