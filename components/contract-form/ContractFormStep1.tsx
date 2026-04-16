// ContractForm Step 1: Thông tin chung — redesigned card-based layout
import React from 'react';
import {
    MapPin, User, UserCheck, Building2, Plus, Trash2, Hash, Calendar, Percent, FileText, Tag, FileSignature, Sparkles, Loader2
} from 'lucide-react';
import {
    Unit, Employee, Customer, ContractType, ContractContact,
    UnitAllocation, EmployeeAllocation, ContractClassification, LineItem
} from '../../types';
import SearchableSelect from '../ui/SearchableSelect';
import DateInput from '../ui/DateInput';
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
    classification: ContractClassification;
    setClassification: (v: ContractClassification) => void;
    endUserId: string | null;
    setEndUserId: (v: string | null) => void;
    endUserName: string;
    setEndUserName: (v: string) => void;
    endUser2Id: string | null;
    setEndUser2Id: (v: string | null) => void;
    endUser2Name: string;
    setEndUser2Name: (v: string) => void;
    signedDate: string;
    setSignedDate: (v: string) => void;
    endDate: string;
    setEndDate: (v: string) => void;
    hasVat: boolean;
    setHasVat: (v: boolean) => void;
    vatRate: number;
    setVatRate: (v: number) => void;
    formContractId: string;
    setFormContractId: (v: string) => void;
    contractNumberStt: string;
    setContractNumberStt: (v: string) => void;
    isIdTouched: boolean;
    setIsIdTouched: (v: boolean) => void;
    duplicateWarning: boolean;
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
    setShowAddEndUser2Dialog: (v: boolean) => void;

    // AI summary
    lineItems: LineItem[];
    onGenerateTitle: () => void;
    isGeneratingTitle: boolean;
}

// --- Accent color class map (Tailwind can't purge dynamic classes) ---
const accentClasses: Record<string, string> = {
    indigo: 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400',
    violet: 'bg-violet-100 dark:bg-violet-900/30 text-violet-600 dark:text-violet-400',
    emerald: 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400',
};

// --- Section Card wrapper ---
const SectionCard: React.FC<{ icon: React.ReactNode; title: string; children: React.ReactNode; delay?: number; accentColor?: string }> = ({
    icon, title, children, delay = 0, accentColor = 'indigo'
}) => (
    <section
        className="bg-slate-50/80 dark:bg-slate-800/60 rounded-xl border border-slate-200/60 dark:border-slate-700 p-4 space-y-3 animate-in slide-in-from-bottom-4 duration-500"
        style={{ animationDelay: `${delay}ms` }}
    >
        <div className="flex items-center gap-2.5">
            <div className={`w-6 h-6 rounded-lg flex items-center justify-center ${accentClasses[accentColor || 'indigo']}`}>
                {icon}
            </div>
            <h3 className="text-xs font-black text-slate-700 dark:text-slate-200 uppercase tracking-widest">{title}</h3>
        </div>
        {children}
    </section>
);

// --- Field Label ---
const FieldLabel: React.FC<{ icon?: React.ReactNode; children: React.ReactNode; required?: boolean }> = ({ icon, children, required }) => (
    <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase ml-0.5 flex items-center gap-1 mb-1">
        {icon}
        {children}
        {required && <span className="text-rose-400 ml-0.5">*</span>}
    </label>
);

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
    classification, setClassification,
    endUserId, setEndUserId,
    endUserName, setEndUserName,
    endUser2Id, setEndUser2Id,
    endUser2Name, setEndUser2Name,
    signedDate, setSignedDate,
    endDate, setEndDate,
    hasVat, setHasVat,
    vatRate, setVatRate,
    formContractId, setFormContractId,
    contractNumberStt, setContractNumberStt,
    isIdTouched, setIsIdTouched,
    duplicateWarning,
    hasCustomerContractNumber, setHasCustomerContractNumber,
    customerContractNumber, setCustomerContractNumber,
    contacts, setContacts,
    addContact, removeContact,
    setShowAddCustomerDialog, setShowAddEndUserDialog, setShowAddEndUser2Dialog,
    lineItems, onGenerateTitle, isGeneratingTitle,
}) => {
    const GLOBAL_ROLES = ['Leadership', 'Admin', 'Legal', 'Accountant', 'ChiefAccountant'];
    const isGlobal = profile && GLOBAL_ROLES.includes(profile.role);

    return (
        <div className="space-y-3">

            {/* ================================================================
                CARD 1: THÔNG TIN HỢP ĐỒNG (Contract Identity)
            ================================================================ */}
            <SectionCard icon={<Tag size={14} />} title="Thông tin hợp đồng" accentColor="indigo">
                <div className="flex flex-wrap items-end gap-3">
                    {/* Loại hồ sơ */}
                    <div className="space-y-1">
                        <FieldLabel>Loại hồ sơ</FieldLabel>
                        <div className="inline-flex bg-white dark:bg-slate-700 p-0.5 rounded-lg border border-slate-200 dark:border-slate-600 shadow-sm">
                            <button
                                type="button"
                                onClick={() => setContractType('HĐ')}
                                className={`px-3 py-2 rounded-md text-[11px] font-semibold transition-all ${contractType === 'HĐ'
                                    ? 'bg-indigo-600 text-white shadow-sm'
                                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-600'
                                    }`}
                            >
                                <FileText size={11} className="inline mr-1 -mt-0.5" />Hợp đồng
                            </button>
                            <button
                                type="button"
                                onClick={() => setContractType('VV')}
                                className={`px-3 py-2 rounded-md text-[11px] font-semibold transition-all ${contractType === 'VV'
                                    ? 'bg-amber-500 text-white shadow-sm'
                                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-600'
                                    }`}
                            >
                                <FileSignature size={11} className="inline mr-1 -mt-0.5" />Vụ việc
                            </button>
                        </div>
                    </div>

                    {/* Số Hợp đồng — structured: {type}_{STT}/{unitCode}_CIC_{year} */}
                    <div className="flex-1 min-w-[220px]">
                        <FieldLabel icon={<Hash size={10} />} required>Số hiệu HĐ theo CIC</FieldLabel>
                        <div className={`flex items-center bg-white dark:bg-slate-900 border rounded-lg overflow-hidden focus-within:ring-1 transition-all ${duplicateWarning ? 'border-rose-400 dark:border-rose-500 focus-within:border-rose-500 focus-within:ring-rose-500/20' : 'border-slate-200 dark:border-slate-700 focus-within:border-indigo-500 focus-within:ring-indigo-500/20'}`}>
                            {/* Prefix: HĐ or VV — auto from contractType */}
                            <span className="px-2.5 py-2 text-sm font-black text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/30 border-r border-slate-200 dark:border-slate-700 select-none whitespace-nowrap">
                                {contractType}_
                            </span>
                            {/* STT — editable */}
                            <input
                                value={contractNumberStt}
                                onChange={(e) => {
                                    const val = e.target.value.replace(/[^0-9]/g, '').slice(0, 4);
                                    setContractNumberStt(val);
                                    setIsIdTouched(true);
                                }}
                                onBlur={() => {
                                    if (contractNumberStt && contractNumberStt.length > 0) {
                                        setContractNumberStt(contractNumberStt.padStart(3, '0'));
                                    }
                                }}
                                placeholder="001"
                                className="w-[52px] text-center px-1 py-2 bg-transparent text-sm font-black text-slate-800 dark:text-slate-200 outline-none"
                            />
                            {/* Suffix: /unitCode_CIC_year — same style as prefix */}
                            <span className="px-2.5 py-2 text-sm font-black text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/30 border-l border-slate-200 dark:border-slate-700 select-none whitespace-nowrap">
                                /{units.find(u => u.id === unitId)?.code || '...'}_CIC_{signedDate ? new Date(signedDate).getFullYear() : new Date().getFullYear()}
                            </span>
                        </div>
                        {duplicateWarning && (
                            <p className="text-[10px] font-bold text-rose-500 mt-1 animate-in slide-in-from-top-1 duration-200">
                                ⚠ Số hiệu này đã tồn tại! Vui lòng đổi STT.
                            </p>
                        )}
                    </div>

                    {/* Ngày ký kết */}
                    <div className="w-[160px]">
                        <FieldLabel icon={<Calendar size={10} />} required>Ngày ký kết</FieldLabel>
                        <DateInput
                            value={signedDate}
                            onChange={setSignedDate}
                            className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm font-bold text-slate-800 dark:text-slate-200 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/20 transition-all"
                        />
                    </div>

                    {/* Ngày kết thúc */}
                    <div className="w-[160px]">
                        <FieldLabel icon={<Calendar size={10} />}>Ngày kết thúc (DK)</FieldLabel>
                        <DateInput
                            value={endDate}
                            onChange={setEndDate}
                            className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm font-bold text-slate-800 dark:text-slate-200 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/20 transition-all"
                        />
                    </div>

                    {/* Số HĐ KH — luôn hiện, cùng flex-1 với Số Hợp đồng */}
                    <div className="flex-1 min-w-[180px]">
                        <FieldLabel>Số hiệu HĐ theo Khách hàng (nếu khác)</FieldLabel>
                        <input
                            value={customerContractNumber}
                            onChange={(e) => setCustomerContractNumber(e.target.value)}
                            placeholder="Nhập..."
                            className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm font-bold text-slate-700 dark:text-slate-300 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/20 transition-all"
                        />
                    </div>
                </div>
            </SectionCard>

            {/* ================================================================
                CARD 2: TỔ CHỨC THỰC HIỆN (Organization)
            ================================================================ */}
            <SectionCard icon={<UserCheck size={14} />} title="Tổ chức thực hiện" delay={80} accentColor="violet">
                <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
                    {/* Đơn vị thực hiện — 4 cols */}
                    <div className="md:col-span-4 space-y-1">
                        <FieldLabel icon={<MapPin size={10} />} required>Đơn vị thực hiện</FieldLabel>
                        <select
                            value={unitId}
                            onChange={(e) => { setUnitId(e.target.value); setSalespersonId(''); setEmployeeAllocations([]); }}
                            className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm font-bold text-slate-800 dark:text-slate-200 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/20 transition-all cursor-pointer"
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

                    {/* Nhân viên thực hiện — 8 cols */}
                    <div className="md:col-span-8 space-y-1">
                        <FieldLabel icon={<User size={10} />} required>Nhân viên thực hiện</FieldLabel>
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
                                    <div key={idx} className="grid items-center gap-2" style={{ gridTemplateColumns: hasUnitSplit ? '1fr 72px 52px 32px 44px' : '1fr 72px 32px 44px' }}>
                                        <select
                                            value={alloc.employeeId}
                                            onChange={(e) => {
                                                const newAllocs = [...employeeAllocations];
                                                newAllocs[idx].employeeId = e.target.value;
                                                if (isLead) newAllocs[idx].percent = 100 - othersTotal;
                                                setEmployeeAllocations(newAllocs);
                                                if (isLead) setSalespersonId(e.target.value);
                                            }}
                                            className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm font-bold text-slate-800 dark:text-slate-200 outline-none focus:border-indigo-500 transition-all cursor-pointer"
                                        >
                                            <option value="">-- Chọn NV --</option>
                                            {filteredSales.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                                        </select>

                                        <div className="relative">
                                            {isLead ? (
                                                <div className="w-full px-2 py-2 bg-indigo-100 dark:bg-indigo-900/30 border border-indigo-200 dark:border-indigo-700 rounded-lg text-sm font-black text-indigo-600 dark:text-indigo-300 text-center">
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
                                                        className="w-full px-2 py-2 bg-indigo-50 dark:bg-indigo-800/40 border border-indigo-200 dark:border-indigo-700 rounded-lg text-sm font-black text-indigo-600 dark:text-indigo-300 text-center outline-none focus:border-indigo-500"
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
                                                    className="text-slate-300 dark:text-slate-500 hover:text-rose-500 dark:hover:text-rose-400 transition-colors p-1"
                                                >
                                                    <Trash2 size={14} />
                                                </button>
                                            ) : <div className="w-[14px]" />}
                                        </div>

                                        <div className="flex items-center justify-center">
                                            {isLead ? (
                                                <span className="text-[9px] font-bold text-indigo-500 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/30 px-1.5 py-1 rounded whitespace-nowrap">CHÍNH</span>
                                            ) : (
                                                <span className="text-[9px] font-bold text-slate-400 dark:text-slate-500 bg-white dark:bg-slate-800 px-1.5 py-1 rounded whitespace-nowrap border border-slate-200 dark:border-slate-700">PHỤ</span>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                            {employeeAllocations.length === 0 && (
                                <div className="grid items-center gap-2" style={{ gridTemplateColumns: '1fr 72px 32px 44px' }}>
                                    <select
                                        value=""
                                        onChange={(e) => {
                                            if (e.target.value) {
                                                setEmployeeAllocations([{ employeeId: e.target.value, percent: 100, role: 'lead' }]);
                                                setSalespersonId(e.target.value);
                                            }
                                        }}
                                        className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm font-bold text-slate-800 dark:text-slate-200 outline-none cursor-pointer"
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

                {/* Unit Allocations — compact */}
                <div className="pt-1">
                    <UnitAllocationsInput
                        units={units}
                        employees={salespeople}
                        leadUnitId={unitId}
                        allocations={unitAllocations}
                        onChange={setUnitAllocations}
                        onLeadEmployeeChange={setSalespersonId}
                    />
                </div>
            </SectionCard>

            {/* ================================================================
                CARD 3: KHÁCH HÀNG & NỘI DUNG (Customer & Content)
            ================================================================ */}
            <SectionCard icon={<Building2 size={14} />} title="Khách hàng & Nội dung" delay={160} accentColor="emerald">
                {/* 2-column: Customer on left, Content on right */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Left: Customer */}
                    <div className="space-y-3">
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

                        {/* Phân loại HĐ */}
                        <div className="space-y-1">
                            <FieldLabel icon={<Tag size={10} />}>Phân loại HĐ</FieldLabel>
                            <select
                                value={classification}
                                onChange={(e) => setClassification(e.target.value as ContractClassification)}
                                className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-bold text-slate-700 dark:text-slate-300 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/20 transition-all cursor-pointer"
                            >
                                <option value="Thông thường">Thông thường</option>
                                <option value="Bán qua đại lý">Bán qua đại lý (Dealer)</option>
                                <option value="Khách bị LC">Khách bị LC</option>
                                <option value="Hỗ trợ đối tác">Hỗ trợ đối tác</option>
                                <option value="Khác">Khác</option>
                            </select>
                        </div>

                        {/* End User (conditional) */}
                        {classification === 'Bán qua đại lý' && (
                            <div className="animate-in slide-in-from-top-2 duration-300 space-y-3">
                                <SearchableSelect
                                    label="Người dùng cuối (End User 1)"
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
                                <SearchableSelect
                                    label="Người dùng cuối (End User 2)"
                                    value={endUser2Id}
                                    placeholder="Gõ để tìm End User 2..."
                                    getDisplayValue={(id) => id === endUser2Id ? endUser2Name : undefined}
                                    onChange={(euId) => {
                                        setEndUser2Id(euId);
                                        if (euId) {
                                            CustomerService.getById(euId).then(cust => {
                                                if (cust) setEndUser2Name(cust.name);
                                            });
                                        } else {
                                            setEndUser2Name('');
                                        }
                                    }}
                                    onSearch={async (query) => {
                                        const results = await CustomerService.search(query, 20);
                                        return results
                                            .filter(c => !c.type || c.type === 'Customer' || c.type === 'Both')
                                            .map(c => ({ id: c.id, name: c.name, subText: c.industry?.join(', ') || undefined }));
                                    }}
                                    onAddNew={() => setShowAddEndUser2Dialog(true)}
                                    addNewLabel="+ Thêm End User 2 mới"
                                />
                            </div>
                        )}
                    </div>

                    {/* Right: Content */}
                    <div className="space-y-1">
                        <div className="flex items-center justify-between">
                            <FieldLabel icon={<FileText size={10} />}>Nội dung hợp đồng</FieldLabel>
                            <button
                                type="button"
                                onClick={onGenerateTitle}
                                disabled={isGeneratingTitle || lineItems.filter(li => li.name || li.productName).length === 0}
                                className="flex items-center gap-1.5 px-2.5 py-1 bg-violet-50 dark:bg-violet-900/30 text-violet-600 dark:text-violet-400 rounded-lg text-[10px] font-bold border border-violet-200 dark:border-violet-800 hover:bg-violet-100 dark:hover:bg-violet-900/50 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                                title={lineItems.filter(li => li.name || li.productName).length === 0 ? 'Cần có ít nhất 1 sản phẩm/dịch vụ trong Bước 2' : 'AI tự động tóm tắt nội dung từ danh sách sản phẩm'}
                            >
                                {isGeneratingTitle ? (
                                    <Loader2 size={11} className="animate-spin" />
                                ) : (
                                    <Sparkles size={11} />
                                )}
                                AI Tóm tắt
                            </button>
                        </div>
                        <textarea
                            placeholder="VD: Tư vấn giải pháp BIM, Đào tạo chuyên sâu phần mềm Plaxis 3D..."
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm font-bold text-slate-800 dark:text-slate-200 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/20 outline-none h-[90px] resize-none transition-all"
                        />
                    </div>
                </div>

                {/* Contacts — full width */}
                <div className="pt-2 border-t border-slate-200/60 dark:border-slate-700">
                    <div className="flex justify-between items-center mb-2">
                        <label className="text-[11px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Đầu mối liên hệ phía khách hàng</label>
                        <button onClick={addContact} className="flex items-center gap-1 text-indigo-600 dark:text-indigo-400 font-black text-[10px] uppercase hover:text-indigo-800 dark:hover:text-indigo-300 transition-colors">
                            <Plus size={12} /> Thêm đầu mối
                        </button>
                    </div>
                    <div className="space-y-1.5">
                        {contacts.map((contact) => (
                            <div key={contact.id} className="grid grid-cols-12 gap-3 items-center animate-in slide-in-from-left-2 duration-300">
                                <div className="col-span-5">
                                    <input placeholder="Họ tên..." className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-bold text-slate-700 dark:text-slate-300 outline-none focus:border-indigo-500 transition-all" />
                                </div>
                                <div className="col-span-6">
                                    <input placeholder="Vai trò (Mua sắm, Kế toán, Kỹ thuật...)" className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-bold text-slate-700 dark:text-slate-300 outline-none focus:border-indigo-500 transition-all" />
                                </div>
                                <div className="col-span-1 text-center">
                                    {contacts.length > 1 && (
                                        <button onClick={() => removeContact(contact.id)} className="text-slate-300 dark:text-slate-500 hover:text-rose-500 dark:hover:text-rose-400 transition-colors">
                                            <Trash2 size={14} />
                                        </button>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </SectionCard>

        </div>
    );
};

export default React.memo(ContractFormStep1);
