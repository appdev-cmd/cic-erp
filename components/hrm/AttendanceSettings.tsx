// ============================================================
// Attendance Settings UI — CIC ERP
// Configure standard hours, thresholds, and OT rates
// ============================================================

import React, { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { Settings, Clock, Save, Loader2, AlertCircle } from 'lucide-react';
import { AttendanceService } from '../../services/attendanceService';
import type { AttendanceSettings, UpdateAttendanceSettingsInput } from '../../types/attendanceTypes';

export const AttendanceSettingsPanel: React.FC = () => {
    const [settings, setSettings] = useState<AttendanceSettings | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [form, setForm] = useState<UpdateAttendanceSettingsInput>({});

    const fetchSettings = async () => {
        try {
            const data = await AttendanceService.getSettings();
            setSettings(data);
            setForm({
                standard_start_time: data?.standard_start_time || '08:00',
                standard_end_time: data?.standard_end_time || '17:30',
                break_minutes: data?.break_minutes || 90,
                late_threshold_minutes: data?.late_threshold_minutes || 15,
                ot_rate_saturday: data?.ot_rate_saturday || 1.5,
                ot_rate_sunday: data?.ot_rate_sunday || 2.0,
                ot_rate_holiday: data?.ot_rate_holiday || 3.0,
                work_days_per_week: data?.work_days_per_week || 5,
            });
        } catch {
            toast.error('Lỗi tải cấu hình chấm công');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchSettings(); }, []);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value, type } = e.target;
        setForm(prev => ({
            ...prev,
            [name]: type === 'number' ? Number(value) : value
        }));
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            await AttendanceService.updateSettings(form);
            toast.success('Lưu cấu hình thành công');
            fetchSettings();
        } catch {
            toast.error('Lỗi khi lưu cấu hình');
        } finally {
            setSaving(false);
        }
    };

    if (loading) return <div className="flex justify-center p-8"><Loader2 className="animate-spin text-indigo-500" /></div>;
    if (!settings) return <div className="p-8 text-center text-slate-500">Chưa có cấu hình gốc. Vui lòng chạy seed data.</div>;

    const inputCls = "w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none";

    return (
        <div className="bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                <h2 className="text-lg font-black text-slate-900 dark:text-slate-100 flex items-center gap-2">
                    <Settings size={20} className="text-indigo-500" />
                    Cấu hình Chấm công & Giờ làm việc
                </h2>
                <button
                    onClick={handleSave}
                    disabled={saving}
                    className="flex items-center gap-2 px-4 py-2 text-sm font-bold text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors"
                >
                    {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                    Lưu thay đổi
                </button>
            </div>

            <div className="p-6">
                <div className="bg-amber-50 dark:bg-amber-900/20 text-amber-800 dark:text-amber-400 p-4 rounded-lg flex items-start gap-3 mb-8">
                    <AlertCircle size={20} className="shrink-0 mt-0.5" />
                    <div className="text-sm">
                        <p className="font-bold">CIC ERP không sử dụng hệ thống ca kíp (Shift Management).</p>
                        <p className="mt-1 opacity-90">Giờ làm việc áp dụng chung cho toàn công ty từ Thứ 2 đến Thứ 6. Tăng ca (Overtime) chỉ áp dụng cho Thứ 7, Chủ Nhật và các ngày Lễ.</p>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    {/* Quy định giờ làm */}
                    <div className="space-y-6">
                        <div>
                            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 uppercase tracking-wide flex items-center gap-2 mb-4">
                                <Clock size={16} className="text-slate-400" /> Giờ làm việc quy chuẩn
                            </h3>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5">Giờ bắt đầu</label>
                                    <input type="time" name="standard_start_time" value={form.standard_start_time || ''} onChange={handleChange} className={inputCls} />
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5">Giờ kết thúc</label>
                                    <input type="time" name="standard_end_time" value={form.standard_end_time || ''} onChange={handleChange} className={inputCls} />
                                </div>
                            </div>
                        </div>

                        <div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5">Nghỉ trưa (phút)</label>
                                    <input type="number" name="break_minutes" value={form.break_minutes || ''} onChange={handleChange} className={inputCls} />
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5">Ngưỡng đi trễ (phút)</label>
                                    <input type="number" name="late_threshold_minutes" value={form.late_threshold_minutes || ''} onChange={handleChange} className={inputCls} />
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Hệ số tăng ca */}
                    <div className="space-y-6">
                        <div>
                            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 uppercase tracking-wide flex items-center gap-2 mb-4">
                                <Clock size={16} className="text-slate-400" /> Hệ số Tăng ca (Overtime)
                            </h3>
                            <div className="space-y-4">
                                <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700">
                                    <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">Tăng ca Thứ 7</span>
                                    <div className="flex items-center gap-2">
                                        <input type="number" step="0.1" name="ot_rate_saturday" value={form.ot_rate_saturday || ''} onChange={handleChange} className="w-20 px-2 py-1 text-sm text-center bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded" />
                                        <span className="text-slate-500 font-bold">x</span>
                                    </div>
                                </div>
                                <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700">
                                    <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">Tăng ca Chủ Nhật</span>
                                    <div className="flex items-center gap-2">
                                        <input type="number" step="0.1" name="ot_rate_sunday" value={form.ot_rate_sunday || ''} onChange={handleChange} className="w-20 px-2 py-1 text-sm text-center bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded" />
                                        <span className="text-slate-500 font-bold">x</span>
                                    </div>
                                </div>
                                <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700">
                                    <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">Tăng ca Lễ/Tết</span>
                                    <div className="flex items-center gap-2">
                                        <input type="number" step="0.1" name="ot_rate_holiday" value={form.ot_rate_holiday || ''} onChange={handleChange} className="w-20 px-2 py-1 text-sm text-center bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded" />
                                        <span className="text-slate-500 font-bold">x</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
