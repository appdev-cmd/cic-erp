import React from 'react';
import { Mail, Phone, Send } from 'lucide-react';
import { FormSectionProps } from './types';
import DateInput from '../ui/DateInput';

const BasicInfoSection: React.FC<FormSectionProps> = ({ formData, setFormData, units }) => {
    return (
        <div className="w-3/4 grid grid-cols-2 gap-4">
            <div className="col-span-2">
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Họ và tên *</label>
                <input
                    required
                    type="text"
                    value={formData.name}
                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg dark:bg-slate-800 dark:border-slate-800 focus:ring-2 focus:ring-indigo-500"
                    placeholder="Nhập tên nhân viên"
                />
            </div>

            <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Mã nhân viên</label>
                <input
                    type="text"
                    value={formData.employeeCode}
                    onChange={e => setFormData({ ...formData, employeeCode: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg dark:bg-slate-800 dark:border-slate-800 focus:ring-2 focus:ring-indigo-500"
                    placeholder="NV001"
                />
            </div>

            <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Đơn vị *</label>
                <select
                    required
                    value={formData.unitId}
                    onChange={e => setFormData({ ...formData, unitId: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg dark:bg-slate-800 dark:border-slate-800 focus:ring-2 focus:ring-indigo-500"
                >
                    <option value="">-- Chọn đơn vị --</option>
                    {units?.map(unit => (
                        <option key={unit.id} value={unit.id}>{unit.name}</option>
                    ))}
                </select>
            </div>

            <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Chức vụ</label>
                <input
                    type="text"
                    value={formData.position}
                    onChange={e => setFormData({ ...formData, position: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg dark:bg-slate-800 dark:border-slate-800"
                    placeholder="Chuyên viên, Trưởng phòng..."
                />
            </div>

            <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Ngày vào làm</label>
                <DateInput
                    value={formData.dateJoined}
                    onChange={(val) => setFormData({ ...formData, dateJoined: val })}
                    className="w-full px-3 py-2 border rounded-lg dark:bg-slate-800 dark:border-slate-800"
                />
            </div>

            <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1 flex items-center gap-1">
                    <Mail size={14} /> Email *
                </label>
                <input
                    required
                    type="email"
                    value={formData.email}
                    onChange={e => setFormData({ ...formData, email: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg dark:bg-slate-800 dark:border-slate-800"
                    placeholder="email@company.vn"
                />
            </div>

            <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1 flex items-center gap-1">
                    <Phone size={14} /> Số điện thoại
                </label>
                <input
                    type="tel"
                    value={formData.phone}
                    onChange={e => setFormData({ ...formData, phone: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg dark:bg-slate-800 dark:border-slate-800"
                    placeholder="0901234567"
                />
            </div>

            <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1 flex items-center gap-1">
                    <Send size={14} /> Telegram
                </label>
                <input
                    type="text"
                    value={formData.telegram}
                    onChange={e => setFormData({ ...formData, telegram: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg dark:bg-slate-800 dark:border-slate-800"
                    placeholder="@username"
                />
            </div>
        </div>
    );
};

export default BasicInfoSection;
