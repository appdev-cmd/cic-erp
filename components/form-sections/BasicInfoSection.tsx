import React, { useState } from 'react';
import { Mail, Phone, Send, HelpCircle, ChevronDown, ChevronUp, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import { FormSectionProps } from './types';
import DateInput from '../ui/DateInput';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { toast } from 'sonner';

const disabledClass = 'bg-slate-100 dark:bg-slate-800/60 text-slate-500 dark:text-slate-400 cursor-not-allowed opacity-70';

const BasicInfoSection: React.FC<FormSectionProps> = ({ formData, setFormData, units, readOnly, isPersonalSettings }) => {
    const [showTelegramGuide, setShowTelegramGuide] = useState(false);
    const { profile } = useAuth();
    const [isSendingOtp, setIsSendingOtp] = useState(false);
    const [isVerifyingOtp, setIsVerifyingOtp] = useState(false);
    const [showOtpInput, setShowOtpInput] = useState(false);
    const [otpCode, setOtpCode] = useState('');

    const handleSendOtp = async () => {
        if (!formData.telegram || !/^\d+$/.test(formData.telegram)) {
            toast.error("Vui lòng nhập Telegram ID dạng số (VD: 123456789)");
            return;
        }
        
        setIsSendingOtp(true);
        try {
            const { data, error } = await supabase.functions.invoke('telegram-otp', {
                body: { 
                    action: 'send', 
                    telegramId: formData.telegram, 
                    employeeId: profile?.employeeId 
                }
            });
            if (error) throw error;
            if (data?.error === "BOT_NOT_STARTED") {
                toast.error("Bạn chưa kết nối với bot. Vui lòng gửi /start cho @cic_vn_bot trước.");
                setShowTelegramGuide(true);
                return;
            }
            if (data?.error) throw new Error(data.error);
            
            toast.success("Mã OTP đã được gửi đến Telegram của bạn");
            setShowOtpInput(true);
            setOtpCode('');
        } catch (err: any) {
             toast.error(err.message || "Không thể gửi OTP");
        } finally {
            setIsSendingOtp(false);
        }
    };

    const handleVerifyOtp = async () => {
        if (!otpCode || otpCode.length !== 6) {
            toast.error("Vui lòng nhập đủ 6 số OTP");
            return;
        }

        setIsVerifyingOtp(true);
        try {
            const { data, error } = await supabase.functions.invoke('telegram-otp', {
                body: { 
                    action: 'verify', 
                    telegramId: formData.telegram, 
                    otpCode: otpCode,
                    employeeId: profile?.employeeId 
                }
            });
            if (error) throw error;
            if (data?.error) throw new Error(data.error);

            toast.success("Xác thực Telegram thành công!");
            setFormData(prev => ({ ...prev, telegram_verified: true }));
            setShowOtpInput(false);
        } catch (err: any) {
            toast.error(err.message || "Xác thực thất bại");
        } finally {
            setIsVerifyingOtp(false);
        }
    };

    return (
        <div className="w-3/4 grid grid-cols-2 gap-4">
            <div className="col-span-2">
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Họ và tên *</label>
                <input
                    required
                    type="text"
                    value={formData.name}
                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                    disabled={readOnly}
                    className={`w-full px-3 py-2 border rounded-lg dark:bg-slate-800 dark:border-slate-800 focus:ring-2 focus:ring-indigo-500 ${readOnly ? disabledClass : ''}`}
                    placeholder="Nhập tên nhân viên"
                />
            </div>

            <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Mã nhân viên</label>
                <input
                    type="text"
                    value={formData.employeeCode}
                    onChange={e => setFormData({ ...formData, employeeCode: e.target.value })}
                    disabled={readOnly}
                    className={`w-full px-3 py-2 border rounded-lg dark:bg-slate-800 dark:border-slate-800 focus:ring-2 focus:ring-indigo-500 ${readOnly ? disabledClass : ''}`}
                    placeholder="NV001"
                />
            </div>

            <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Đơn vị *</label>
                <select
                    required
                    value={formData.unitId}
                    onChange={e => setFormData({ ...formData, unitId: e.target.value })}
                    disabled={readOnly}
                    className={`w-full px-3 py-2 border rounded-lg dark:bg-slate-800 dark:border-slate-800 focus:ring-2 focus:ring-indigo-500 ${readOnly ? disabledClass : ''}`}
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
                    disabled={readOnly}
                    className={`w-full px-3 py-2 border rounded-lg dark:bg-slate-800 dark:border-slate-800 ${readOnly ? disabledClass : ''}`}
                    placeholder="Chuyên viên, Trưởng phòng..."
                />
            </div>

            <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Ngày vào làm</label>
                {readOnly ? (
                    <input
                        type="text"
                        value={formData.dateJoined}
                        disabled
                        className={`w-full px-3 py-2 border rounded-lg ${disabledClass}`}
                    />
                ) : (
                    <DateInput
                        value={formData.dateJoined}
                        onChange={(val) => setFormData({ ...formData, dateJoined: val })}
                        className="w-full px-3 py-2 border rounded-lg dark:bg-slate-800 dark:border-slate-800"
                    />
                )}
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
                    disabled={readOnly}
                    className={`w-full px-3 py-2 border rounded-lg dark:bg-slate-800 dark:border-slate-800 ${readOnly ? disabledClass : ''}`}
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

            <div className="col-span-2">
                <div className="flex items-center justify-between mb-1">
                    <label className="text-sm font-medium text-slate-700 dark:text-slate-300 flex items-center gap-1">
                        <Send size={14} /> Telegram ID {isPersonalSettings && <span className="text-red-500">*</span>}
                    </label>
                    {isPersonalSettings && (
                        <div className="flex items-center gap-3">
                            {formData.telegram_verified && formData.telegram ? (
                                <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/30 px-2 py-0.5 rounded flex items-center gap-1 shrink-0">
                                    <CheckCircle size={12} /> Đã xác thực
                                </span>
                            ) : formData.telegram ? (
                                <span className="text-xs font-medium text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/30 px-2 py-0.5 rounded flex items-center gap-1 shrink-0">
                                    <AlertCircle size={12} /> Chưa xác thực
                                </span>
                            ) : null}
                            <button
                                type="button"
                                onClick={() => setShowTelegramGuide(!showTelegramGuide)}
                                className="text-blue-500 dark:text-blue-400 hover:text-blue-600 dark:hover:text-blue-300 transition-colors cursor-pointer text-xs flex items-center gap-1 shrink-0"
                                title="Hướng dẫn lấy Telegram ID"
                            >
                                <HelpCircle size={14} /> Hướng dẫn
                            </button>
                        </div>
                    )}
                </div>
                
                <div className="flex gap-2">
                    <input
                        type="text"
                        required={isPersonalSettings}
                        value={formData.telegram}
                        onChange={e => {
                            setFormData({ ...formData, telegram: e.target.value, telegram_verified: false });
                            setShowOtpInput(false);
                            setOtpCode('');
                        }}
                        disabled={(readOnly && !isPersonalSettings) || (isPersonalSettings && formData.telegram_verified)}
                        className={`flex-1 px-3 py-2 border rounded-lg dark:bg-slate-800 dark:border-slate-800 focus:ring-2 focus:ring-indigo-500 ${((readOnly && !isPersonalSettings) || formData.telegram_verified) ? disabledClass : ''}`}
                        placeholder="VD: 123456789 (Nhập ID dạng số)"
                    />
                    {isPersonalSettings && !formData.telegram_verified && formData.telegram && (
                        <button
                            type="button"
                            onClick={handleSendOtp}
                            disabled={isSendingOtp}
                            className="px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 disabled:opacity-50"
                        >
                            {isSendingOtp ? <Loader2 size={16} className="animate-spin" /> : "Lấy mã OTP"}
                        </button>
                    )}
                </div>

                {/* OTP Input Section */}
                {showOtpInput && !formData.telegram_verified && (
                    <div className="mt-3 p-4 bg-indigo-50 dark:bg-indigo-900/10 border border-indigo-100 dark:border-indigo-800/50 rounded-lg animate-in slide-in-from-top-2">
                        <label className="block text-sm font-medium text-indigo-900 dark:text-indigo-300 mb-2">
                            Nhập mã OTP 6 số từ bot @cic_vn_bot
                        </label>
                        <div className="flex gap-2">
                            <input
                                type="text"
                                maxLength={6}
                                value={otpCode}
                                onChange={e => setOtpCode(e.target.value.replace(/\D/g, ''))}
                                className="w-32 px-3 py-2 border border-indigo-200 dark:border-indigo-700 rounded-lg dark:bg-slate-800 focus:ring-2 focus:ring-indigo-500 text-center tracking-widest font-mono text-lg"
                                placeholder="------"
                            />
                            <button
                                type="button"
                                onClick={handleVerifyOtp}
                                disabled={isVerifyingOtp || otpCode.length !== 6}
                                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium transition-colors flex items-center gap-2 disabled:opacity-50"
                            >
                                {isVerifyingOtp ? <Loader2 size={16} className="animate-spin" /> : "Xác nhận"}
                            </button>
                        </div>
                    </div>
                )}

                {/* Telegram ID Guide */}
                {isPersonalSettings && showTelegramGuide && (
                    <div className="mt-3 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg text-sm space-y-4 animate-in slide-in-from-top-2">
                        <div className="flex items-center gap-2 text-blue-700 dark:text-blue-300 font-semibold text-base mb-1">
                            <Send size={16} />
                            Hướng dẫn kết nối và lấy Telegram ID
                        </div>
                        
                        <div className="space-y-2 text-slate-700 dark:text-slate-300">
                            <div className="font-semibold text-blue-800 dark:text-blue-200 flex items-start gap-2">
                                <span className="bg-blue-100 dark:bg-blue-800 text-blue-700 dark:text-blue-300 rounded-full w-5 h-5 flex items-center justify-center text-xs shrink-0 mt-0.5">1</span>
                                Bắt đầu với Bot của CIC ERP (Bắt buộc)
                            </div>
                            <p className="pl-7 text-slate-600 dark:text-slate-400">Bot cần quyền gửi tin nhắn cho bạn. Vui lòng mở Telegram, tìm kiếm <strong>@cic_vn_bot</strong> và nhấn <strong>START</strong> (hoặc gửi tin nhắn <code className="bg-blue-100 dark:bg-blue-900/50 px-1 rounded">/start</code>).</p>
                        </div>

                        <div className="space-y-2 text-slate-700 dark:text-slate-300">
                            <div className="font-semibold text-blue-800 dark:text-blue-200 flex items-start gap-2">
                                <span className="bg-blue-100 dark:bg-blue-800 text-blue-700 dark:text-blue-300 rounded-full w-5 h-5 flex items-center justify-center text-xs shrink-0 mt-0.5">2</span>
                                Lấy mã số ID cá nhân của bạn
                            </div>
                            <p className="pl-7 text-slate-600 dark:text-slate-400 mb-2">Telegram ID là một dãy số đặc trưng cho mỗi tài khoản.</p>
                            <ol className="list-decimal list-inside space-y-1.5 pl-7">
                                <li>Mở Telegram, gõ vào ô tìm kiếm: <strong>userinfobot</strong> (hoặc @userinfobot)</li>
                                <li>Chọn bot có tên là <strong>User Info</strong> và nhấn <strong>START</strong></li>
                                <li>Bot sẽ trả về một tin nhắn. Tìm dòng có chữ <strong>Id</strong> (VD: <code>Id: 123456789</code>)</li>
                                <li>Copy dãy số <strong>123456789</strong> đó và dán vào ô Telegram ID ở trên.</li>
                            </ol>
                        </div>
                        
                        <div className="space-y-2 text-slate-700 dark:text-slate-300">
                            <div className="font-semibold text-blue-800 dark:text-blue-200 flex items-start gap-2">
                                <span className="bg-blue-100 dark:bg-blue-800 text-blue-700 dark:text-blue-300 rounded-full w-5 h-5 flex items-center justify-center text-xs shrink-0 mt-0.5">3</span>
                                Xác thực ID
                            </div>
                            <p className="pl-7 text-slate-600 dark:text-slate-400">Nhấn nút <strong>Lấy mã OTP</strong>. Hệ thống (từ @cic_vn_bot) sẽ gửi bạn mã 6 số để xác nhận chính chủ.</p>
                        </div>

                        <p className="text-xs text-slate-500 dark:text-slate-400 italic pt-1 border-t border-blue-200/50 dark:border-blue-800/50">
                            Hệ thống sẽ gửi thông báo công việc, tài chính tự động cho bạn thông qua Telegram ID này.
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default BasicInfoSection;
