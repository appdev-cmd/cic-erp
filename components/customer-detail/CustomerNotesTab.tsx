// CustomerDetail — Notes Tab
import React from 'react';
import { StickyNote, Edit3, Save, Loader2 } from 'lucide-react';
import { Customer } from '../../types';

interface CustomerNotesTabProps {
    customer: Customer;
    editingNotes: boolean;
    setEditingNotes: (v: boolean) => void;
    notesValue: string;
    setNotesValue: (v: string) => void;
    savingNotes: boolean;
    handleSaveNotes: () => void;
}

const CustomerNotesTab: React.FC<CustomerNotesTabProps> = React.memo(({
    customer, editingNotes, setEditingNotes, notesValue, setNotesValue, savingNotes, handleSaveNotes
}) => (
    <div className="space-y-4">
        <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <StickyNote size={18} className="text-indigo-500" />
                Ghi chú khách hàng
            </h3>
            {!editingNotes ? (
                <button
                    onClick={() => { setEditingNotes(true); setNotesValue(customer.notes || ''); }}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 text-white text-sm font-bold rounded-lg hover:bg-indigo-700 transition-colors"
                >
                    <Edit3 size={14} />
                    {customer.notes ? 'Sửa' : 'Thêm ghi chú'}
                </button>
            ) : (
                <div className="flex gap-2">
                    <button onClick={() => setEditingNotes(false)} className="px-3 py-1.5 text-sm text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors">
                        Hủy
                    </button>
                    <button onClick={handleSaveNotes} disabled={savingNotes} className="flex items-center gap-1.5 px-4 py-1.5 bg-indigo-600 text-white text-sm font-bold rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50">
                        {savingNotes ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                        Lưu
                    </button>
                </div>
            )}
        </div>

        {editingNotes ? (
            <textarea
                value={notesValue}
                onChange={(e) => setNotesValue(e.target.value)}
                placeholder="Nhập ghi chú về khách hàng... (thông tin quan trọng, lưu ý khi làm việc, yêu cầu đặc biệt...)"
                className="w-full min-h-[200px] px-4 py-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-700 dark:text-slate-300 focus:ring-2 focus:ring-indigo-500 outline-none resize-y"
                autoFocus
            />
        ) : customer.notes ? (
            <div className="bg-slate-50 dark:bg-slate-800 rounded-lg p-5">
                <p className="text-sm text-slate-700 dark:text-slate-300 whitespace-pre-wrap leading-relaxed">{customer.notes}</p>
            </div>
        ) : (
            <div className="text-center py-12 bg-slate-50 dark:bg-slate-800 rounded-lg">
                <div className="w-14 h-14 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-3">
                    <StickyNote size={24} className="text-slate-400" />
                </div>
                <h3 className="text-sm font-bold text-slate-700 dark:text-slate-300">Chưa có ghi chú</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Thêm ghi chú để lưu thông tin quan trọng</p>
                <button
                    onClick={() => { setEditingNotes(true); setNotesValue(''); }}
                    className="mt-3 px-4 py-2 bg-indigo-600 text-white text-sm font-bold rounded-lg hover:bg-indigo-700 transition-colors"
                >
                    <Edit3 size={14} className="inline mr-1.5" />Thêm ghi chú
                </button>
            </div>
        )}
    </div>
));

CustomerNotesTab.displayName = 'CustomerNotesTab';
export default CustomerNotesTab;
