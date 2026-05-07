import React from 'react';
import { Calendar, MapPin, CreditCard, Users } from 'lucide-react';
import { FormSectionProps } from './types';
import DateInput from '../ui/DateInput';

const PersonalSection: React.FC<FormSectionProps> = ({ formData, setFormData }) => {
    return (
        <div className="border-t pt-4 dark:border-slate-800">
            <h4 className="font-medium mb-3 flex items-center gap-2 text-slate-800 dark:text-slate-200">
                <Users size={18} className="text-blue-500" />
                Thông tin cá nhân
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div>
                    <label className="block text-xs text-slate-500 mb-1">Ngày sinh</label>
                    <DateInput
                        value={formData.dateOfBirth}
                        onChange={(val) => setFormData({ ...formData, dateOfBirth: val })}
                        className="w-full px-3 py-2 border rounded-lg dark:bg-slate-800 dark:border-slate-800"
                    />
                </div>
                <div>
                    <label className="block text-xs text-slate-500 mb-1">Giới tính</label>
                    <select
                        value={formData.gender}
                        onChange={e => setFormData({ ...formData, gender: e.target.value as any })}
                        className="w-full px-3 py-2 border rounded-lg dark:bg-slate-800 dark:border-slate-800"
                    >
                        <option value="">-- Chọn --</option>
                        <option value="male">Nam</option>
                        <option value="female">Nữ</option>
                        <option value="other">Khác</option>
                    </select>
                </div>
                <div>
                    <label className="block text-xs text-slate-500 mb-1">Tình trạng hôn nhân</label>
                    <select
                        value={formData.maritalStatus}
                        onChange={e => setFormData({ ...formData, maritalStatus: e.target.value as any })}
                        className="w-full px-3 py-2 border rounded-lg dark:bg-slate-800 dark:border-slate-800"
                    >
                        <option value="">-- Chọn --</option>
                        <option value="single">Độc thân</option>
                        <option value="married">Đã kết hôn</option>
                        <option value="divorced">Ly hôn</option>
                        <option value="widowed">Góa</option>
                    </select>
                </div>
                <div>
                    <label className="block text-xs text-slate-500 mb-1">Số CCCD/CMND</label>
                    <input
                        type="text"
                        value={formData.idNumber}
                        onChange={e => setFormData({ ...formData, idNumber: e.target.value })}
                        className="w-full px-3 py-2 border rounded-lg dark:bg-slate-800 dark:border-slate-800"
                        placeholder="001234567890"
                    />
                </div>
                <div className="col-span-1 sm:col-span-2 lg:col-span-4">
                    <label className="block text-xs text-slate-500 mb-1 flex items-center gap-1">
                        <MapPin size={12} /> Địa chỉ
                    </label>
                    <input
                        type="text"
                        value={formData.address}
                        onChange={e => setFormData({ ...formData, address: e.target.value })}
                        className="w-full px-3 py-2 border rounded-lg dark:bg-slate-800 dark:border-slate-800"
                        placeholder="Số nhà, đường, quận, thành phố"
                    />
                </div>
            </div>
        </div>
    );
};

export default PersonalSection;
