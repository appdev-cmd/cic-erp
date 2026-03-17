
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { toast } from 'sonner';
import { Save, Loader2, X, Building, User, Phone, Mail, MapPin, Search, Network } from 'lucide-react';
import Modal from './ui/Modal';
import { Unit, KPIPlan, Employee } from '../types';
import { EmployeeService, UnitService } from '../services';

interface UnitFormProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (data: Omit<Unit, 'id'> | Unit) => Promise<void>;
    unit?: Unit;
    presetParentId?: string;
}

const UnitForm: React.FC<UnitFormProps> = ({ isOpen, onClose, onSave, unit, presetParentId }) => {
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [employees, setEmployees] = useState<Employee[]>([]);
    const [allUnits, setAllUnits] = useState<Unit[]>([]);
    const [managerSearch, setManagerSearch] = useState('');
    const [showManagerDropdown, setShowManagerDropdown] = useState(false);
    const managerDropdownRef = useRef<HTMLDivElement>(null);

    // Close manager dropdown on outside click
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (managerDropdownRef.current && !managerDropdownRef.current.contains(e.target as Node)) {
                setShowManagerDropdown(false);
            }
        };
        if (showManagerDropdown) {
            document.addEventListener('mousedown', handleClickOutside);
            return () => document.removeEventListener('mousedown', handleClickOutside);
        }
    }, [showManagerDropdown]);

    const [formData, setFormData] = useState({
        name: '',
        type: 'Center' as 'Company' | 'Branch' | 'Center' | 'BackOffice',
        code: '',
        target: {
            signing: 0,
            revenue: 0,
            adminProfit: 0,
            revProfit: 0,
            cash: 0,
        } as KPIPlan,
        functions: '',
        // Phase 2 fields
        managerId: '',
        parentId: '' as string | undefined,
        address: '',
        phone: '',
        email: '',
        description: '',
    });

    // Fetch employees and units for selectors
    useEffect(() => {
        const fetchData = async () => {
            try {
                const [empData, unitsData] = await Promise.all([
                    EmployeeService.list({ page: 1, pageSize: 100 }),
                    UnitService.getAll()
                ]);
                const empList = Array.isArray(empData) ? empData : (empData as any).data || [];
                setEmployees(empList);
                setAllUnits(unitsData.filter(u => u.id !== 'all'));
            } catch (error) {
                console.error('Error fetching form data:', error);
            }
        };
        if (isOpen) fetchData();
    }, [isOpen]);

    // Filter employees for manager dropdown
    const filteredManagers = useMemo(() => {
        if (!managerSearch) return employees.slice(0, 10);
        const search = managerSearch.toLowerCase();
        return employees.filter(e =>
            e.name.toLowerCase().includes(search) ||
            e.position?.toLowerCase().includes(search)
        ).slice(0, 10);
    }, [employees, managerSearch]);

    const selectedManager = employees.find(e => e.id === formData.managerId);


    useEffect(() => {
        if (unit) {
            setFormData({
                name: unit.name,
                type: unit.type,
                code: unit.code,
                target: { ...unit.target },
                functions: unit.functions || '',
                // Phase 2 fields
                managerId: unit.managerId || '',
                parentId: unit.parentId || '',
                address: unit.address || '',
                phone: unit.phone || '',
                email: unit.email || '',
                description: unit.description || '',
            });
            setManagerSearch('');
        } else {
            setFormData({
                name: '',
                type: 'Center',
                code: '',
                target: {
                    signing: 0,
                    revenue: 0,
                    adminProfit: 0,
                    revProfit: 0,
                    cash: 0,
                },
                functions: '',
                managerId: '',
                parentId: presetParentId || '',
                address: '',
                phone: '',
                email: '',
                description: '',
            });
            setManagerSearch('');
        }
    }, [unit, isOpen, presetParentId]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);
        try {
            const payload = unit ? { ...formData, id: unit.id } : formData;
            await onSave(payload);
            onClose();
        } catch (error) {
            console.error('Lỗi khi lưu đơn vị:', error);
            toast.error('Có lỗi xảy ra khi lưu dữ liệu. Vui lòng thử lại.');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleChange = (field: string, value: any) => {
        setFormData(prev => ({ ...prev, [field]: value }));
    };



    return (
        <Modal isOpen={isOpen} onClose={onClose} title={unit ? "Chỉnh sửa Đơn vị" : "Thêm Đơn vị mới"}>
            <form onSubmit={handleSubmit} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Basic Info */}
                    <div className="space-y-4">
                        <h3 className="font-bold text-slate-800 dark:text-slate-200 border-b pb-2">Thông tin chung</h3>

                        <div>
                            <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1">Tên Đơn vị <span className="text-red-500">*</span></label>
                            <input
                                type="text"
                                required
                                value={formData.name}
                                onChange={(e) => handleChange('name', e.target.value)}
                                className="w-full px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-800 bg-white dark:bg-slate-800 focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                                placeholder="Ví dụ: Trung tâm Kinh doanh số 1"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1">Mã Đơn vị <span className="text-red-500">*</span></label>
                            <input
                                type="text"
                                required
                                value={formData.code}
                                onChange={(e) => handleChange('code', e.target.value)}
                                className="w-full px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-800 bg-white dark:bg-slate-800 focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                                placeholder="Ví dụ: CENTER_01"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1">Loại hình</label>
                            <select
                                value={formData.type}
                                onChange={(e) => handleChange('type', e.target.value)}
                                className="w-full px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-800 bg-white dark:bg-slate-800 focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                            >
                                <option value="Company">Công ty</option>
                                <option value="Branch">Chi nhánh</option>
                                <option value="Center">Trung tâm</option>
                                <option value="BackOffice">Phòng ban</option>
                            </select>
                        </div>

                        {/* Parent Unit Selector */}
                        <div>
                            <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1">
                                <Network className="inline w-4 h-4 mr-1" />Đơn vị cha
                            </label>
                            <select
                                value={formData.parentId || ''}
                                onChange={(e) => handleChange('parentId', e.target.value || undefined)}
                                className="w-full px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-800 bg-white dark:bg-slate-800 focus:ring-2 focus:ring-indigo-500 outline-none transition-all text-slate-900 dark:text-slate-100"
                            >
                                <option value="">— Không chọn (Root) —</option>
                                {allUnits
                                    .filter(u => u.id !== unit?.id) // Exclude self to prevent circular
                                    .map(u => (
                                        <option key={u.id} value={u.id}>
                                            {u.name} ({u.code})
                                        </option>
                                    ))
                                }
                            </select>
                            {presetParentId && !unit && (
                                <p className="text-xs text-indigo-500 dark:text-indigo-400 mt-1">
                                    Tự động chọn từ sơ đồ tổ chức
                                </p>
                            )}
                        </div>

                        {/* Manager Selector */}
                        <div className="relative" ref={managerDropdownRef}>
                            <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1">
                                <User className="inline w-4 h-4 mr-1" />Trưởng đơn vị
                            </label>
                            <div className="relative">
                                <input
                                    type="text"
                                    value={managerSearch || selectedManager?.name || ''}
                                    onChange={(e) => {
                                        setManagerSearch(e.target.value);
                                        setShowManagerDropdown(true);
                                    }}
                                    onFocus={() => setShowManagerDropdown(true)}
                                    className="w-full px-4 py-2 pl-10 rounded-lg border border-slate-300 dark:border-slate-800 bg-white dark:bg-slate-800 focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                                    placeholder="Tìm nhân viên..."
                                />
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                            </div>
                            {showManagerDropdown && (
                                <div className="absolute z-20 w-full mt-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-800 rounded-lg shadow-lg max-h-48 overflow-auto">
                                    <button
                                        type="button"
                                        onClick={() => {
                                            handleChange('managerId', '');
                                            setManagerSearch('');
                                            setShowManagerDropdown(false);
                                        }}
                                        className="w-full px-4 py-2 text-left text-sm text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700"
                                    >
                                        -- Không chọn --
                                    </button>
                                    {filteredManagers.map(emp => (
                                        <button
                                            key={emp.id}
                                            type="button"
                                            onClick={() => {
                                                handleChange('managerId', emp.id);
                                                setManagerSearch('');
                                                setShowManagerDropdown(false);
                                            }}
                                            className={`w-full px-4 py-2 text-left text-sm hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center gap-2 ${formData.managerId === emp.id ? 'bg-indigo-50 dark:bg-indigo-900/30' : ''}`}
                                        >
                                            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white text-xs font-bold">
                                                {emp.name.charAt(0)}
                                            </div>
                                            <div>
                                                <p className="font-medium text-slate-800 dark:text-slate-200">{emp.name}</p>
                                                <p className="text-xs text-slate-500">{emp.position || 'Nhân viên'}</p>
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Contact Info - Right Column */}
                    <div className="space-y-4">
                        <h3 className="font-bold text-slate-800 dark:text-slate-200 border-b pb-2">Thông tin liên hệ</h3>

                        <div>
                            <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1">
                                <MapPin className="inline w-4 h-4 mr-1" />Địa chỉ
                            </label>
                            <input
                                type="text"
                                value={formData.address}
                                onChange={(e) => handleChange('address', e.target.value)}
                                className="w-full px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-800 bg-white dark:bg-slate-800 focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                                placeholder="Địa chỉ đơn vị"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1">
                                <Phone className="inline w-4 h-4 mr-1" />Số điện thoại
                            </label>
                            <input
                                type="tel"
                                value={formData.phone}
                                onChange={(e) => handleChange('phone', e.target.value)}
                                className="w-full px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-800 bg-white dark:bg-slate-800 focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                                placeholder="0xxx xxx xxx"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1">
                                <Mail className="inline w-4 h-4 mr-1" />Email
                            </label>
                            <input
                                type="email"
                                value={formData.email}
                                onChange={(e) => handleChange('email', e.target.value)}
                                className="w-full px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-800 bg-white dark:bg-slate-800 focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                                placeholder="email@company.com"
                            />
                        </div>
                    </div>

                    <div className="md:col-span-2">
                        <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1">Chức năng - Nhiệm vụ</label>
                        <textarea
                            value={formData.functions || ''}
                            onChange={(e) => handleChange('functions', e.target.value)}
                            className="w-full px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-800 bg-white dark:bg-slate-800 focus:ring-2 focus:ring-indigo-500 outline-none transition-all min-h-[80px]"
                            placeholder="Mô tả chức năng, nhiệm vụ của đơn vị..."
                        />
                    </div>
                </div>



                <div className="flex justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-6 py-2.5 rounded-lg font-bold text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800 transition-all"
                    >
                        Hủy bỏ
                    </button>
                    <button
                        type="submit"
                        disabled={isSubmitting}
                        className="px-6 py-2.5 rounded-lg font-bold bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg shadow-indigo-200 dark:shadow-none transition-all flex items-center gap-2"
                    >
                        {isSubmitting ? <Loader2 className="animate-spin" size={20} /> : <Save size={20} />}
                        {unit ? 'Cập nhật' : 'Thêm mới'}
                    </button>
                </div>
            </form>
        </Modal >
    );
};

export default UnitForm;
