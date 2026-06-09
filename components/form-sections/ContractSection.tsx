import React from 'react';
import { Building } from 'lucide-react';
import { FormSectionProps } from './types';
import DateInput from '../ui/DateInput';

const VN_BANKS = [
    'Vietcombank (VCB)',
    'BIDV',
    'VietinBank (CTG)',
    'Agribank',
    'MB Bank',
    'Techcombank (TCB)',
    'ACB',
    'VPBank',
    'SHB',
    'Sacombank (STB)',
    'HDBank',
    'TPBank',
    'OCB',
    'LienVietPostBank (LPB)',
    'VIB',
    'MSB (Maritime Bank)',
    'Eximbank (EIB)',
    'SeABank',
    'NamABank',
    'ABBank',
    'BaoVietBank',
    'PGBank',
    'KienLongBank',
    'NCB',
    'VietABank',
    'SaigonBank',
    'BacABank',
    'DongABank',
    'GPBank',
    'CIMB Vietnam',
    'UOB Vietnam',
    'Shinhan Bank Vietnam',
    'Woori Bank Vietnam',
    'Standard Chartered Vietnam',
    'HSBC Vietnam',
    'ANZ Vietnam',
];

const disabledClass = 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 cursor-not-allowed opacity-70';

const ContractSection: React.FC<FormSectionProps> = ({ formData, setFormData, readOnly }) => {
    return (
        <div className="border-t pt-4 dark:border-slate-800">
            <h4 className="font-medium mb-3 flex items-center gap-2 text-slate-800 dark:text-slate-200">
                <Building size={18} className="text-purple-500" />
                Hợp đồng lao động
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                    <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">Loại hợp đồng</label>
                    <select
                        value={formData.contractType}
                        onChange={e => setFormData({ ...formData, contractType: e.target.value })}
                        disabled={readOnly}
                        className={`w-full px-3 py-2 border rounded-lg dark:bg-slate-800 dark:border-slate-800 ${readOnly ? disabledClass : ''}`}
                    >
                        <option value="">-- Chọn --</option>
                        <option value="Full-time">Toàn thời gian</option>
                        <option value="Part-time">Bán thời gian</option>
                        <option value="Contract">Hợp đồng</option>
                        <option value="Intern">Thực tập</option>
                        <option value="Freelance">Tự do</option>
                    </select>
                </div>
                <div>
                    <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">Ngày hết hạn HĐ</label>
                    {readOnly ? (
                        <input
                            type="text"
                            value={formData.contractEndDate}
                            disabled
                            className={`w-full px-3 py-2 border rounded-lg ${disabledClass}`}
                        />
                    ) : (
                        <DateInput
                            value={formData.contractEndDate}
                            onChange={(val) => setFormData({ ...formData, contractEndDate: val })}
                            className="w-full px-3 py-2 border rounded-lg dark:bg-slate-800 dark:border-slate-800"
                        />
                    )}
                </div>
                <div>
                    <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">Số tài khoản ngân hàng</label>
                    <input
                        type="text"
                        value={formData.bankAccount}
                        onChange={e => setFormData({ ...formData, bankAccount: e.target.value })}
                        className="w-full px-3 py-2 border rounded-lg dark:bg-slate-800 dark:border-slate-800"
                        placeholder="1234567890"
                    />
                </div>
                <div>
                    <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">Ngân hàng</label>
                    <input
                        type="text"
                        list="vn-banks-list"
                        value={formData.bankName}
                        onChange={e => setFormData({ ...formData, bankName: e.target.value })}
                        className="w-full px-3 py-2 border rounded-lg dark:bg-slate-800 dark:border-slate-800"
                        placeholder="Nhập hoặc chọn ngân hàng..."
                    />
                    <datalist id="vn-banks-list">
                        {VN_BANKS.map(bank => (
                            <option key={bank} value={bank} />
                        ))}
                    </datalist>
                </div>
            </div>
        </div>
    );
};

export default ContractSection;
