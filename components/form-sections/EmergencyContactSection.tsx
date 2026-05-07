import React from 'react';
import { Heart } from 'lucide-react';
import { FormSectionProps } from './types';

const EmergencyContactSection: React.FC<FormSectionProps> = ({ formData, setFormData }) => {
    return (
        <div className="border-t pt-4 dark:border-slate-800">
            <h4 className="font-medium mb-3 flex items-center gap-2 text-slate-800 dark:text-slate-200">
                <Heart size={18} className="text-red-500" />
                Liên hệ khẩn cấp
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                    <label className="block text-xs text-slate-500 mb-1">Người thân</label>
                    <input
                        type="text"
                        value={formData.emergencyContact}
                        onChange={e => setFormData({ ...formData, emergencyContact: e.target.value })}
                        className="w-full px-3 py-2 border rounded-lg dark:bg-slate-800 dark:border-slate-800"
                        placeholder="Tên người thân"
                    />
                </div>
                <div>
                    <label className="block text-xs text-slate-500 mb-1">SĐT khẩn cấp</label>
                    <input
                        type="tel"
                        value={formData.emergencyPhone}
                        onChange={e => setFormData({ ...formData, emergencyPhone: e.target.value })}
                        className="w-full px-3 py-2 border rounded-lg dark:bg-slate-800 dark:border-slate-800"
                        placeholder="0912345678"
                    />
                </div>
            </div>
        </div>
    );
};

export default EmergencyContactSection;
