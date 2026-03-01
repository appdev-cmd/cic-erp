// ContractForm Step 1: Đơn vị & Nhân sự + Thông tin Khách hàng
import React from 'react';
import {
    MapPin, User, UserCheck, Building2, Plus, Trash2, Hash, Calendar, Percent, FileText
} from 'lucide-react';
import {
    Unit, Employee, Customer, ContractType, ContractContact,
    UnitAllocation, EmployeeAllocation
} from '../../types';
import SearchableSelect from '../ui/SearchableSelect';
import { CustomerService } from '../../services';
import UnitAllocationsInput from './UnitAllocationsInput';

interface ContractFormStep1Props {
    // Auth
    profile: any;

    // Data options
    units: Unit[];
    salespeople: Employee[];
    filteredSales: Employee[];

    // Form values
    contractType: ContractType;
    setContractType: (v: ContractType) => void;
    unitId: string;
    setUnitId: (v: string) => void;
    coordinatingUnitId: string;
    setCoordinatingUnitId: (v: string) => void;
    salespersonId: string;
    setSalespersonId: (v: string) => void;
    employeeAllocations: EmployeeAllocation[];
    setEmployeeAllocations: (v: EmployeeAllocation[]) => void;
    unitAllocations: UnitAllocation[];
    setUnitAllocations: (v: UnitAllocation[]) => void;
    customerId: string | null;
    setCustomerId: (v: string | null) => void;
    clientName: string;
    setClientName: (v: string) => void;
    title: string;
    setTitle: (v: string) => void;
    isDealerSale: boolean;
    setIsDealerSale: (v: boolean) => void;
    endUserId: string | null;
    setEndUserId: (v: string | null) => void;
    endUserName: string;
    setEndUserName: (v: string) => void;
    signedDate: string;
    setSignedDate: (v: string) => void;
    hasVat: boolean;
    setHasVat: (v: boolean) => void;
    vatRate: number;
    setVatRate: (v: number) => void;
    formContractId: string;
    setFormContractId: (v: string) => void;
    isIdTouched: boolean;
    setIsIdTouched: (v: boolean) => void;
    hasCustomerContractNumber: boolean;
    setHasCustomerContractNumber: (v: boolean) => void;
    customerContractNumber: string;
    setCustomerContractNumber: (v: string) => void;
    contacts: ContractContact[];
    setContacts: (v: ContractContact[]) => void;
    addContact: () => void;
    removeContact: (id: string) => void;

    // Quick-add dialog triggers
    setShowAddCustomerDialog: (v: boolean) => void;
    setShowAddEndUserDialog: (v: boolean) => void;
}

const ContractFormStep1: React.FC<ContractFormStep1Props> = ({
    profile,
    units, salespeople, filteredSales,
    contractType, setContractType,
    unitId, setUnitId,
    coordinatingUnitId, setCoordinatingUnitId,
    salespersonId, setSalespersonId,
    employeeAllocations, setEmployeeAllocations,
    unitAllocations, setUnitAllocations,
    customerId, setCustomerId,
    clientName, setClientName,
    title, setTitle,
    isDealerSale, setIsDealerSale,
    endUserId, setEndUserId,
    endUserName, setEndUserName,
    signedDate, setSignedDate,
    hasVat, setHasVat,
    vatRate, setVatRate,
    formContractId, setFormContractId,
    isIdTouched, setIsIdTouched,
    hasCustomerContractNumber, setHasCustomerContractNumber,
    customerContractNumber, setCustomerContractNumber,
    contacts, setContacts,
    addContact, removeContact,
    setShowAddCustomerDialog, setShowAddEndUserDialog,
}) => {
    const GLOBAL_ROLES = ['Leadership', 'Admin', 'Legal', 'Accountant', 'ChiefAccountant'];
    const isGlobal = profile && GLOBAL_ROLES.includes(profile.role);

    return (
        <>
            {/* 1. ĐƠN VỊ & NHÂN SỰ */}
            <section className="space-y-6 animate-in slide-in-from-right-8 duration-500">
                <div className="flex items-center gap-3 border-l-4 border-indigo-600 pl-4">
                    <h3 className="text-sm font-black text-slate-800 dark:text-slate-200 uppercase tracking-widest flex items-center gap-2">
                        <UserCheck size={16} /> Đơn vị & Nhân sự thực hiện
                    </h3>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {/* Unit Dropdown */}
                    <div className="space-y-2">
                        <label className="text-[11px] font-bold text-slate-500 uppercase ml-1 flex items-center gap-1">
                            <MapPin size={10} /> Đơn vị thực hiện
                        </label>
                        <select
                            value={unitId}
                            onChange={(e) => { setUnitId(e.target.value); setSalespersonId(''); setEmployeeAllocations([]); }}
                            className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-800 rounded-lg text-sm font-bold outline-none focus:border-indigo-500 transition-all"
                        >
                            {units
                                .filter(u => {
                                    if (u.id === 'all' || u.type === 'Company' || u.type === 'BackOffice') return false;
                                    if (isGlobal || !profile?.unitId) return true;
                                    return u.id === profile.unitId;
                                })
                                .map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                        </select>
                    </div>

                    {/* Employee Allocations */}
                    <div className="col-span-2 space-y-2">
                        <label className="text-[11px] font-bold text-slate-500 uppercase ml-1 flex items-center gap-1">
                            <User size={10} /> Nhân viên thực hiện
                        </label>
                        <div className="space-y-1.5">
                            {employeeAllocations.map((alloc, idx) => {
                                const isLead = idx === 0;
                                const othersTotal = employeeAllocations.filter((_, i) => i !== 0).reduce((s, a) => s + a.percent, 0);
                                const displayPercent = isLead ? (100 - othersTotal) : alloc.percent;

                                const supportUnitsTotal = unitAllocations.filter(a => a.role === 'support').reduce((s, a) => s + a.percent, 0);
                                const leadUnitPercent = supportUnitsTotal > 0 ? (100 - supportUnitsTotal) : 100;
                                const effectivePercent = Math.round((displayPercent * leadUnitPercent) / 100);
                                const hasUnitSplit = supportUnitsTotal > 0;

                                return (
                                    <div key={idx} className="grid items-center gap-2" style={{ gridTemplateColumns: hasUnitSplit ? '1fr 80px 60px 36px 48px' : '1fr 80px 36px 48px' }}>
                                        <select
                                            value={alloc.employeeId}
                                            onChange={(e) => {
                                                const newAllocs = [...employeeAllocations];
                                                newAllocs[idx].employeeId = e.target.value;
                                                if (isLead) newAllocs[idx].percent = 100 - othersTotal;
                                                setEmployeeAllocations(newAllocs);
                                                if (isLead) setSalespersonId(e.target.value);
                                            }}
                                            className="w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm font-bold outline-none focus:border-indigo-500 transition-all"
                                        >
                                            <option value="">-- Chọn NV --</option>
                                            {filteredSales.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                                        </select>

                                        <div className="relative">
                                            {isLead ? (
                                                <div className="w-full px-2 py-2.5 bg-indigo-100 dark:bg-indigo-900/30 border border-indigo-200 dark:border-indigo-700 rounded-lg text-sm font-black text-indigo-600 dark:text-indigo-300 text-center">
                                                    {displayPercent}
                                                    <span className="text-[10px] font-bold text-indigo-400 ml-0.5">%</span>
                                                </div>
                                            ) : (
                                                <div className="relative">
                                                    <input
                                                        type="number"
                                                        min="1"
                                                        max={99}
                                                        value={alloc.percent || ''}
                                                        onChange={(e) => {
                                                            const val = Math.min(99, Math.max(0, Number(e.target.value)));
                                                            const newAllocs = [...employeeAllocations];
                                                            newAllocs[idx].percent = val;
                                                            const newOthersTotal = newAllocs.filter((_, i) => i !== 0).reduce((s, a) => s + a.percent, 0);
                                                            newAllocs[0].percent = Math.max(0, 100 - newOthersTotal);
                                                            setEmployeeAllocations(newAllocs);
                                                        }}
                                                        className="w-full px-2 py-2.5 bg-indigo-50 dark:bg-indigo-800/40 border border-indigo-200 dark:border-indigo-700 rounded-lg text-sm font-black text-indigo-600 dark:text-indigo-300 text-center outline-none focus:border-indigo-500"
                                                    />
                                                    <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] font-bold text-indigo-400">%</span>
                                                </div>
                                            )}
                                        </div>

                                        {hasUnitSplit && (
                                            <div className="text-center">
                                                <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20 px-1.5 py-1 rounded whitespace-nowrap">
                                                    → {effectivePercent}%
                                                </span>
                                            </div>
                                        )}

                                        <div className="flex items-center justify-center">
                                            {employeeAllocations.length > 1 ? (
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        const newAllocs = employeeAllocations.filter((_, i) => i !== idx);
                                                        const newOthersTotal = newAllocs.filter((_, i) => i !== 0).reduce((s, a) => s + a.percent, 0);
                                                        if (newAllocs.length > 0) newAllocs[0].percent = Math.max(0, 100 - newOthersTotal);
                                                        setEmployeeAllocations(newAllocs);
                                                        if (idx === 0 && newAllocs.length > 0) {
                                                            setSalespersonId(newAllocs[0].employeeId);
                                                        }
                                                    }}
                                                    className="text-slate-300 hover:text-rose-500 transition-colors p-1"
                                                >
                                                    <Trash2 size={14} />
                                                </button>
                                            ) : <div className="w-[14px]" />}
                                        </div>

                                        <div className="flex items-center justify-center">
                                            {isLead ? (
                                                <span className="text-[9px] font-bold text-indigo-500 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/30 px-1.5 py-1 rounded whitespace-nowrap">CHÍNH</span>
                                            ) : (
                                                <span className="text-[9px] font-bold text-slate-400 dark:text-slate-500 bg-slate-50 dark:bg-slate-800 px-1.5 py-1 rounded whitespace-nowrap">PHỤ</span>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                            {employeeAllocations.length === 0 && (
                                <div className="grid items-center gap-2" style={{ gridTemplateColumns: '1fr 80px 36px 48px' }}>
                                    <select
                                        value=""
                                        onChange={(e) => {
                                            if (e.target.value) {
                                                setEmployeeAllocations([{ employeeId: e.target.value, percent: 100, role: 'lead' }]);
                                                setSalespersonId(e.target.value);
                                            }
                                        }}
                                        className="w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm font-bold outline-none"
                                    >
                                        <option value="">-- Chọn NV --</option>
                                        {filteredSales.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                                    </select>
                                    <div /><div /><div />
                                </div>
                            )}
                            <button
                                type="button"
                                onClick={() => {
                                    if (employeeAllocations.length === 0) {
                                        setEmployeeAllocations([{ employeeId: '', percent: 100, role: 'lead' }]);
                                    } else {
                                        const newAllocs = [...employeeAllocations];
                                        const currentOthersTotal = newAllocs.filter((_, i) => i !== 0).reduce((s, a) => s + a.percent, 0);
                                        const defaultPercent = Math.min(30, Math.max(1, 100 - currentOthersTotal - 1));
                                        newAllocs.push({ employeeId: '', percent: defaultPercent, role: 'member' });
                                        newAllocs[0].percent = Math.max(0, 100 - currentOthersTotal - defaultPercent);
                                        setEmployeeAllocations(newAllocs);
                                    }
                                }}
                                className="text-indigo-600 dark:text-indigo-400 text-[10px] font-bold flex items-center gap-1 hover:text-indigo-800 dark:hover:text-indigo-300 transition-colors mt-1"
                            >
                                <Plus size={10} /> Thêm nhân viên
                            </button>
                        </div>
                    </div>
                </div>

                {/* Support Allocations */}
                <div className="mt-4">
                    <UnitAllocationsInput
                        units={units}
                        employees={salespeople}
                        leadUnitId={unitId}
                        allocations={unitAllocations}
                        onChange={setUnitAllocations}
                        onLeadEmployeeChange={setSalespersonId}
                    />
                </div>
            </section>

            {/* 2. THÔNG TIN KHÁCH HÀNG & NỘI DUNG */}
            <section className="space-y-6 animate-in slide-in-from-right-8 duration-500 delay-100">
                <div className="flex items-center gap-3 border-l-4 border-slate-600 pl-4">
                    <h3 className="text-sm font-black text-slate-800 dark:text-slate-200 uppercase tracking-widest flex items-center gap-2">
                        <Building2 size={16} /> Thông tin Khách hàng & Nội dung
                    </h3>
                </div>
                {/* Row 1: Loại hồ sơ + Số HĐ + Ngày ký kết */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="space-y-2">
                        <label className="text-[11px] font-bold text-slate-500 uppercase ml-1 block mb-1">Loại hồ sơ</label>
                        <div className="inline-flex bg-slate-100 dark:bg-slate-800 p-1 rounded-lg border border-slate-200 dark:border-slate-700">
                            <button
                                type="button"
                                onClick={() => setContractType('HĐ')}
                                className={`px-5 py-1.5 rounded-md text-[13px] font-semibold transition-all ${contractType === 'HĐ'
                                    ? 'bg-white dark:bg-slate-600 text-indigo-700 dark:text-indigo-300 shadow-sm dark:shadow-none'
                                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'
                                    }`}
                            >
                                📋 Hợp đồng
                            </button>
                            <button
                                type="button"
                                onClick={() => setContractType('VV')}
                                className={`px-5 py-1.5 rounded-md text-[13px] font-semibold transition-all ${contractType === 'VV'
                                    ? 'bg-white dark:bg-slate-600 text-amber-600 dark:text-amber-300 shadow-sm dark:shadow-none'
                                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'
                                    }`}
                            >
                                🤝 Vụ việc
                            </button>
                        </div>
                    </div>
                    <div className="space-y-2">
                        <label className="text-[11px] font-bold text-slate-500 uppercase ml-1 flex items-center gap-1">
                            <Hash size={10} /> Mã hợp đồng
                        </label>
                        <input
                            value={formContractId}
                            onChange={(e) => { setFormContractId(e.target.value); setIsIdTouched(true); }}
                            placeholder="Tự động tạo..."
                            className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-800 rounded-lg text-sm font-bold outline-none focus:border-indigo-500 transition-all"
                        />
                    </div>
                    <div className="space-y-2">
                        <label className="text-[11px] font-bold text-slate-500 uppercase ml-1 flex items-center gap-1">
                            <Calendar size={10} /> Ngày ký kết
                        </label>
                        <input
                            type="date"
                            value={signedDate}
                            onChange={(e) => setSignedDate(e.target.value)}
                            className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-800 rounded-lg text-sm font-bold text-slate-800 dark:text-slate-200 outline-none focus:border-indigo-500 transition-all"
                        />
                    </div>
                </div>

                {/* Row 2: Dealer sale checkbox */}
                <div className="flex items-center gap-3">
                    <label className="flex items-center gap-2 cursor-pointer select-none">
                        <input
                            type="checkbox"
                            checked={isDealerSale}
                            onChange={(e) => setIsDealerSale(e.target.checked)}
                            className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                        />
                        <span className="text-xs font-bold text-slate-600 dark:text-slate-400">Bán qua đại lý (Dealer)</span>
                    </label>
                    {hasCustomerContractNumber ? (
                        <div className="flex items-center gap-2">
                            <span className="text-[11px] font-bold text-slate-500">Số HĐ KH:</span>
                            <input
                                value={customerContractNumber}
                                onChange={(e) => setCustomerContractNumber(e.target.value)}
                                placeholder="Nhập số HĐ KH..."
                                className="px-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-bold outline-none w-40"
                            />
                            <button onClick={() => { setHasCustomerContractNumber(false); setCustomerContractNumber(''); }} className="text-slate-400 hover:text-rose-500">
                                <Trash2 size={12} />
                            </button>
                        </div>
                    ) : (
                        <button onClick={() => setHasCustomerContractNumber(true)} className="text-indigo-500 text-[10px] font-bold hover:text-indigo-700">
                            + Số HĐ Khách hàng
                        </button>
                    )}
                </div>

                {/* Row 3: Customer + End-user */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                        <SearchableSelect
                            label="Khách hàng"
                            value={customerId}
                            placeholder="Gõ để tìm khách hàng..."
                            getDisplayValue={(id) => id === customerId ? clientName : undefined}
                            onChange={(cId) => {
                                setCustomerId(cId);
                                if (cId) {
                                    CustomerService.getById(cId).then(cust => {
                                        if (cust) setClientName(cust.name);
                                    });
                                } else {
                                    setClientName('');
                                }
                            }}
                            onSearch={async (query) => {
                                const results = await CustomerService.search(query, 20);
                                return results
                                    .filter(c => !c.type || c.type === 'Customer' || c.type === 'Both')
                                    .map(c => ({ id: c.id, name: c.name, subText: c.industry?.join(', ') || undefined }));
                            }}
                            onAddNew={() => setShowAddCustomerDialog(true)}
                            addNewLabel="+ Thêm khách hàng mới"
                        />
                    </div>
                    {isDealerSale && (
                        <div className="space-y-2 animate-in slide-in-from-right-4 duration-300">
                            <SearchableSelect
                                label="Người dùng cuối (End User)"
                                value={endUserId}
                                placeholder="Gõ để tìm End User..."
                                getDisplayValue={(id) => id === endUserId ? endUserName : undefined}
                                onChange={(euId) => {
                                    setEndUserId(euId);
                                    if (euId) {
                                        CustomerService.getById(euId).then(cust => {
                                            if (cust) setEndUserName(cust.name);
                                        });
                                    } else {
                                        setEndUserName('');
                                    }
                                }}
                                onSearch={async (query) => {
                                    const results = await CustomerService.search(query, 20);
                                    return results
                                        .filter(c => !c.type || c.type === 'Customer' || c.type === 'Both')
                                        .map(c => ({ id: c.id, name: c.name, subText: c.industry?.join(', ') || undefined }));
                                }}
                                onAddNew={() => setShowAddEndUserDialog(true)}
                                addNewLabel="+ Thêm End User mới"
                            />
                        </div>
                    )}
                </div>

                {/* Nội dung hợp đồng */}
                <div className="space-y-2">
                    <label className="text-[11px] font-bold text-slate-500 uppercase ml-1">Nội dung hợp đồng</label>
                    <textarea
                        placeholder="VD: Tư vấn giải pháp BIM, Đào tạo chuyên sâu phần mềm Plaxis 3D..."
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        className="w-full px-5 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-800 rounded-lg text-sm font-bold focus:border-indigo-500 outline-none h-20"
                    />
                </div>

                {/* Multi-contact List */}
                <div className="space-y-4">
                    <div className="flex justify-between items-center">
                        <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest">Đầu mối liên hệ phía khách hàng</label>
                        <button onClick={addContact} className="flex items-center gap-1 text-indigo-600 font-black text-[10px] uppercase">
                            <Plus size={12} /> Thêm đầu mối
                        </button>
                    </div>
                    <div className="space-y-3">
                        {contacts.map((contact) => (
                            <div key={contact.id} className="grid grid-cols-12 gap-3 items-center animate-in slide-in-from-left-2 duration-300">
                                <div className="col-span-5">
                                    <input placeholder="Họ tên..." className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-800 rounded-lg text-xs font-bold" />
                                </div>
                                <div className="col-span-6">
                                    <input placeholder="Vai trò (Mua sắm, Kế toán, Kỹ thuật...)" className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-800 rounded-lg text-xs font-bold" />
                                </div>
                                <div className="col-span-1 text-center">
                                    {contacts.length > 1 && (
                                        <button onClick={() => removeContact(contact.id)} className="text-slate-300 hover:text-rose-500 transition-colors">
                                            <Trash2 size={16} />
                                        </button>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </section>
        </>
    );
};

export default React.memo(ContractFormStep1);
