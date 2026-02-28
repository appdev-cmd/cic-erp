import React, { useState, useEffect } from 'react';
import { toast } from 'sonner';
import {
    UserPlus,
    Phone,
    Mail,
    Pencil,
    Trash2,
    X,
    Check,
    Loader2,
    User,
    Briefcase,
    MessageSquare
} from 'lucide-react';
import { CustomerContact } from '../types';
import { CustomerService } from '../services';

interface CustomerContactsTabProps {
    customerId: string;
}

const CustomerContactsTab: React.FC<CustomerContactsTabProps> = ({ customerId }) => {
    const [contacts, setContacts] = useState<CustomerContact[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isAdding, setIsAdding] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);

    // Form state
    const [formData, setFormData] = useState({
        name: '',
        position: '',
        phone: '',
        email: '',
        isPrimary: false,
        notes: ''
    });

    const resetForm = () => {
        setFormData({ name: '', position: '', phone: '', email: '', isPrimary: false, notes: '' });
    };

    const fetchContacts = async () => {
        setIsLoading(true);
        try {
            const data = await CustomerService.getContacts(customerId);
            setContacts(data);
        } catch (err) {
            console.error('Error fetching contacts', err);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchContacts();
    }, [customerId]);

    const handleSave = async () => {
        if (!formData.name.trim()) {
            toast.error('Vui lòng nhập tên liên hệ');
            return;
        }

        try {
            if (editingId) {
                const updated = await CustomerService.updateContact(editingId, {
                    name: formData.name,
                    position: formData.position,
                    phone: formData.phone,
                    email: formData.email,
                    isPrimary: formData.isPrimary,
                    notes: formData.notes
                });
                setContacts(prev => prev.map(c => c.id === editingId ? updated : c));
                toast.success('Cập nhật liên hệ thành công');
                setEditingId(null);
            } else {
                const created = await CustomerService.createContact({
                    customerId,
                    name: formData.name,
                    position: formData.position,
                    phone: formData.phone,
                    email: formData.email,
                    isPrimary: formData.isPrimary,
                    notes: formData.notes
                });
                setContacts(prev => [...prev, created]);
                toast.success('Thêm liên hệ thành công');
                setIsAdding(false);
            }
            resetForm();
        } catch (err: any) {
            toast.error('Lỗi: ' + err.message);
        }
    };

    const handleEdit = (contact: CustomerContact) => {
        setEditingId(contact.id);
        setFormData({
            name: contact.name || '',
            position: contact.position || '',
            phone: contact.phone || '',
            email: contact.email || '',
            isPrimary: contact.isPrimary || false,
            notes: contact.notes || ''
        });
        setIsAdding(false);
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Xóa liên hệ này?')) return;
        try {
            await CustomerService.deleteContact(id);
            setContacts(prev => prev.filter(c => c.id !== id));
            toast.success('Đã xóa liên hệ');
        } catch (err: any) {
            toast.error('Lỗi: ' + err.message);
        }
    };

    const handleCancel = () => {
        setIsAdding(false);
        setEditingId(null);
        resetForm();
    };

    const getInitials = (name: string) => {
        return name.split(' ').map(w => w[0]).slice(-2).join('').toUpperCase();
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center py-16">
                <Loader2 className="w-6 h-6 animate-spin text-indigo-600" />
            </div>
        );
    }

    // Inline form component
    const InlineForm = () => (
        <div className="bg-slate-50 dark:bg-slate-800/50 rounded-lg p-4 space-y-3 border border-slate-200 dark:border-slate-700">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                    <label className="text-[10px] font-bold text-slate-500 uppercase">Họ tên *</label>
                    <input
                        type="text"
                        value={formData.name}
                        onChange={(e) => setFormData(f => ({ ...f, name: e.target.value }))}
                        placeholder="Nguyễn Văn A"
                        className="w-full mt-1 px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                        autoFocus
                    />
                </div>
                <div>
                    <label className="text-[10px] font-bold text-slate-500 uppercase">Chức vụ</label>
                    <input
                        type="text"
                        value={formData.position}
                        onChange={(e) => setFormData(f => ({ ...f, position: e.target.value }))}
                        placeholder="Giám đốc, Trưởng phòng..."
                        className="w-full mt-1 px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                    />
                </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                    <label className="text-[10px] font-bold text-slate-500 uppercase">Số điện thoại</label>
                    <input
                        type="tel"
                        value={formData.phone}
                        onChange={(e) => setFormData(f => ({ ...f, phone: e.target.value }))}
                        placeholder="0901 234 567"
                        className="w-full mt-1 px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                    />
                </div>
                <div>
                    <label className="text-[10px] font-bold text-slate-500 uppercase">Email</label>
                    <input
                        type="email"
                        value={formData.email}
                        onChange={(e) => setFormData(f => ({ ...f, email: e.target.value }))}
                        placeholder="email@company.com"
                        className="w-full mt-1 px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                    />
                </div>
            </div>
            <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase">Ghi chú</label>
                <input
                    type="text"
                    value={formData.notes}
                    onChange={(e) => setFormData(f => ({ ...f, notes: e.target.value }))}
                    placeholder="Ghi chú thêm..."
                    className="w-full mt-1 px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                />
            </div>
            <div className="flex items-center justify-between pt-1">
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <input
                        type="checkbox"
                        checked={formData.isPrimary}
                        onChange={(e) => setFormData(f => ({ ...f, isPrimary: e.target.checked }))}
                        className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                    />
                    <span className="font-medium text-slate-700 dark:text-slate-300">Liên hệ chính</span>
                </label>
                <div className="flex gap-2">
                    <button onClick={handleCancel} className="px-3 py-1.5 text-sm text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors">
                        <X size={14} className="inline mr-1" />Hủy
                    </button>
                    <button onClick={handleSave} className="px-4 py-1.5 bg-indigo-600 text-white text-sm font-bold rounded-lg hover:bg-indigo-700 transition-colors">
                        <Check size={14} className="inline mr-1" />{editingId ? 'Cập nhật' : 'Thêm'}
                    </button>
                </div>
            </div>
        </div>
    );

    return (
        <div className="space-y-4">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <User size={18} className="text-indigo-500" />
                    <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                        Danh sách liên hệ
                    </h3>
                    <span className="text-xs bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 px-2 py-0.5 rounded-full font-bold">
                        {contacts.length}
                    </span>
                </div>
                {!isAdding && !editingId && (
                    <button
                        onClick={() => { setIsAdding(true); resetForm(); }}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 text-white text-sm font-bold rounded-lg hover:bg-indigo-700 transition-colors"
                    >
                        <UserPlus size={14} />
                        Thêm
                    </button>
                )}
            </div>

            {/* Add Form */}
            {isAdding && <InlineForm />}

            {/* Contact Cards */}
            {contacts.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {contacts.map(contact => (
                        <div key={contact.id}>
                            {editingId === contact.id ? (
                                <InlineForm />
                            ) : (
                                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-4 hover:border-indigo-200 dark:hover:border-indigo-900/50 transition-all group">
                                    <div className="flex items-start gap-3">
                                        {/* Avatar */}
                                        <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-xs flex-shrink-0 ${contact.isPrimary
                                            ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-400 ring-2 ring-indigo-500'
                                            : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
                                            }`}>
                                            {getInitials(contact.name || '?')}
                                        </div>

                                        {/* Info */}
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2">
                                                <p className="font-bold text-sm text-slate-900 dark:text-slate-100 truncate">
                                                    {contact.name}
                                                </p>
                                                {contact.isPrimary && (
                                                    <span className="px-1.5 py-0.5 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400 text-[9px] font-bold rounded">
                                                        CHÍNH
                                                    </span>
                                                )}
                                            </div>
                                            {contact.position && (
                                                <p className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1 mt-0.5">
                                                    <Briefcase size={10} />{contact.position}
                                                </p>
                                            )}
                                            <div className="flex flex-wrap gap-3 mt-2 text-xs text-slate-500 dark:text-slate-400">
                                                {contact.phone && (
                                                    <a href={`tel:${contact.phone}`} className="flex items-center gap-1 hover:text-indigo-600 transition-colors" onClick={e => e.stopPropagation()}>
                                                        <Phone size={11} />{contact.phone}
                                                    </a>
                                                )}
                                                {contact.email && (
                                                    <a href={`mailto:${contact.email}`} className="flex items-center gap-1 hover:text-indigo-600 transition-colors truncate max-w-[200px]" onClick={e => e.stopPropagation()}>
                                                        <Mail size={11} />{contact.email}
                                                    </a>
                                                )}
                                            </div>
                                            {contact.notes && (
                                                <p className="text-[11px] text-slate-400 mt-1.5 flex items-start gap-1">
                                                    <MessageSquare size={10} className="mt-0.5 flex-shrink-0" />
                                                    {contact.notes}
                                                </p>
                                            )}
                                        </div>

                                        {/* Actions */}
                                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                                            <button
                                                onClick={() => handleEdit(contact)}
                                                className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 rounded-lg transition-all"
                                            >
                                                <Pencil size={13} />
                                            </button>
                                            <button
                                                onClick={() => handleDelete(contact.id)}
                                                className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/30 rounded-lg transition-all"
                                            >
                                                <Trash2 size={13} />
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            ) : !isAdding && (
                <div className="text-center py-12 bg-slate-50 dark:bg-slate-800/30 rounded-lg">
                    <div className="w-14 h-14 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-3">
                        <User size={24} className="text-slate-400" />
                    </div>
                    <h3 className="text-sm font-bold text-slate-700 dark:text-slate-300">Chưa có liên hệ</h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Thêm người liên hệ để quản lý tốt hơn</p>
                    <button
                        onClick={() => { setIsAdding(true); resetForm(); }}
                        className="mt-3 px-4 py-2 bg-indigo-600 text-white text-sm font-bold rounded-lg hover:bg-indigo-700 transition-colors"
                    >
                        <UserPlus size={14} className="inline mr-1.5" />Thêm liên hệ đầu tiên
                    </button>
                </div>
            )}
        </div>
    );
};

export default CustomerContactsTab;
