import React from 'react';
import { GraduationCap } from 'lucide-react';
import { FormSectionProps } from './types';

const EducationSection: React.FC<FormSectionProps> = ({ formData, setFormData }) => {
    return (
        <div className="border-t pt-4 dark:border-slate-800">
            <h4 className="font-medium mb-3 flex items-center gap-2 text-slate-800 dark:text-slate-200">
                <GraduationCap size={18} className="text-amber-500" />
                Học vấn & Chuyên môn
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                <div>
                    <label className="block text-xs text-slate-500 mb-1">Trình độ học vấn</label>
                    <input
                        type="text"
                        value={formData.education}
                        onChange={e => setFormData({ ...formData, education: e.target.value })}
                        className="w-full px-3 py-2 border rounded-lg dark:bg-slate-800 dark:border-slate-800"
                        placeholder="Đại học, Thạc sĩ..."
                    />
                </div>
                <div>
                    <label className="block text-xs text-slate-500 mb-1">Chuyên ngành</label>
                    <input
                        type="text"
                        value={formData.specialization}
                        onChange={e => setFormData({ ...formData, specialization: e.target.value })}
                        className="w-full px-3 py-2 border rounded-lg dark:bg-slate-800 dark:border-slate-800"
                        placeholder="CNTT, Xây dựng..."
                    />
                </div>
                <div>
                    <label className="block text-xs text-slate-500 mb-1">Chứng chỉ</label>
                    <input
                        type="text"
                        value={formData.certificates}
                        onChange={e => setFormData({ ...formData, certificates: e.target.value })}
                        className="w-full px-3 py-2 border rounded-lg dark:bg-slate-800 dark:border-slate-800"
                        placeholder="PMP, AWS, IELTS..."
                    />
                </div>
            </div>
        </div>
    );
};

export default EducationSection;
