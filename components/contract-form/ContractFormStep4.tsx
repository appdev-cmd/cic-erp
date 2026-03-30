import React, { useState, useEffect, useMemo } from 'react';
import { Briefcase, Plus, Trash2, ChevronDown, ChevronRight, CheckSquare, Square, Info, User, Clock, Zap } from 'lucide-react';
import { EmployeeService } from '../../services';
import type { Employee, LineItem, ContractWorkflowSteps } from '../../types';
import { DEFAULT_WORKFLOW_STEPS } from '../../types';
import { ContractFormTaskItem } from '../../types/taskTypes';
import SearchableSelect from '../ui/SearchableSelect';
import { useAuth } from '../../contexts/AuthContext';

interface ContractFormStep4Props {
  workflowSteps: ContractWorkflowSteps;
  setWorkflowSteps: React.Dispatch<React.SetStateAction<ContractWorkflowSteps>>;
  lineItems: LineItem[];
  // Legacy: still support manual tasks
  customTasks: Partial<ContractFormTaskItem>[];
  setCustomTasks: React.Dispatch<React.SetStateAction<Partial<ContractFormTaskItem>[]>>;
}

// Helper component for a workflow checkbox row
function WorkflowCheckbox({
  checked,
  onChange,
  label,
  sublabel,
  disabled,
  alwaysOn,
  assignee,
  indent = 0,
  children,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  sublabel?: string;
  disabled?: boolean;
  alwaysOn?: boolean;
  assignee?: string;
  indent?: number;
  children?: React.ReactNode;
}) {
  const isDisabled = disabled || alwaysOn;
  return (
    <div className={`${indent > 0 ? 'ml-8 border-l-2 border-slate-200 dark:border-slate-700 pl-4' : ''}`}>
      <label
        className={`flex items-start gap-3 py-2.5 px-3 rounded-lg transition-colors cursor-pointer select-none group
          ${checked ? 'bg-indigo-50/50 dark:bg-indigo-900/10' : 'hover:bg-slate-50 dark:hover:bg-slate-800'}
          ${isDisabled ? 'cursor-default' : ''}
        `}
      >
        <div className="pt-0.5">
          {checked ? (
            <CheckSquare
              size={18}
              className={`${alwaysOn ? 'text-emerald-500 dark:text-emerald-400' : 'text-indigo-600 dark:text-indigo-400'} transition-colors`}
            />
          ) : (
            <Square
              size={18}
              className="text-slate-300 dark:text-slate-600 group-hover:text-slate-400 dark:group-hover:text-slate-500 transition-colors"
            />
          )}
          <input
            type="checkbox"
            checked={checked}
            onChange={e => !isDisabled && onChange(e.target.checked)}
            disabled={isDisabled}
            className="sr-only"
          />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`text-sm font-semibold ${checked ? 'text-slate-900 dark:text-slate-100' : 'text-slate-500 dark:text-slate-400'}`}>
              {label}
            </span>
            {alwaysOn && (
              <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400 uppercase tracking-wider">
                Luôn có
              </span>
            )}
            {assignee && (
              <span className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                <User size={9} /> {assignee}
              </span>
            )}
          </div>
          {sublabel && (
            <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">{sublabel}</p>
          )}
        </div>
      </label>
      {checked && children && (
        <div className="mt-1 mb-2 animate-in fade-in slide-in-from-top-1 duration-200">
          {children}
        </div>
      )}
    </div>
  );
}

export const ContractFormStep4: React.FC<ContractFormStep4Props> = ({
  workflowSteps, setWorkflowSteps,
  lineItems,
  customTasks, setCustomTasks,
}) => {
  const { profile } = useAuth();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [showManualTasks, setShowManualTasks] = useState(customTasks.length > 0);

  useEffect(() => {
    EmployeeService.getAll().then(setEmployees).catch(() => {});
  }, []);

  const toggleStep = (key: keyof ContractWorkflowSteps, value: boolean) => {
    setWorkflowSteps(prev => {
      const next = { ...prev, [key]: value };
      // Auto-logic: nếu untick advance_procedure → untick advance_has_guarantee
      if (key === 'advance_procedure' && !value) {
        next.advance_has_guarantee = false;
      }
      // Nếu untick warranty_procedure → untick warranty_has_guarantee
      if (key === 'warranty_procedure' && !value) {
        next.warranty_has_guarantee = false;
      }
      return next;
    });
  };

  // Build preview list of tasks that will be generated
  const previewTasks = useMemo(() => {
    const tasks: { title: string; assignee: string; trigger: string; indent: number }[] = [];

    // === GIAI ĐOẠN KÝ KẾT ===
    if (workflowSteps.guarantee_performance) {
      tasks.push({ title: 'Làm BL thực hiện HĐ', assignee: 'Kế toán', trigger: 'Ký HĐ', indent: 0 });
    }

    if (workflowSteps.advance_procedure) {
      tasks.push({ title: 'Thủ tục tạm ứng', assignee: '—', trigger: 'Ký HĐ', indent: 0 });
      if (workflowSteps.advance_has_guarantee) {
        tasks.push({ title: 'Làm BL tạm ứng', assignee: 'Kế toán', trigger: '', indent: 1 });
      }
      tasks.push({ title: 'Giấy đề nghị tạm ứng', assignee: 'Sale', trigger: '', indent: 1 });
      tasks.push({
        title: `Đòi tiền tạm ứng (${workflowSteps.advance_deadline_days} ngày)`,
        assignee: 'Sale',
        trigger: 'Xong TƯ',
        indent: 0,
      });
    }

    // === GIAI ĐOẠN TRIỂN KHAI ===
    if (workflowSteps.import_goods) {
      const itemCount = lineItems.filter(li => li.name).length;
      tasks.push({
        title: `Nhập hàng${itemCount > 0 ? ` (${itemCount} SP)` : ''}`,
        assignee: 'Sale',
        trigger: 'Ký HĐ',
        indent: 0,
      });
    }
    if (workflowSteps.subcontract) {
      tasks.push({ title: 'Ký HĐ thầu phụ', assignee: 'Sale', trigger: 'Ký HĐ', indent: 0 });
    }
    if (workflowSteps.implementation) {
      tasks.push({ title: 'Triển khai TH HĐ', assignee: 'Sale', trigger: 'Ký HĐ', indent: 0 });
      const namedItems = lineItems.filter(li => li.name);
      if (namedItems.length > 1) {
        namedItems.forEach(li => {
          tasks.push({ title: li.name, assignee: 'Sale', trigger: '', indent: 1 });
        });
      }
    }

    // Bàn giao (luôn có)
    const itemCount = lineItems.filter(li => li.name).length;
    tasks.push({
      title: `Bàn giao${itemCount > 0 ? ` (${itemCount} SP)` : ''}`,
      assignee: 'Sale',
      trigger: 'Ký HĐ',
      indent: 0,
    });

    if (workflowSteps.training) {
      tasks.push({ title: 'Đào tạo chuyển giao', assignee: 'Sale', trigger: 'Bàn giao', indent: 0 });
    }

    // === GIAI ĐOẠN NGHIỆM THU & THANH TOÁN ===
    tasks.push({ title: 'Nghiệm thu thanh lý', assignee: 'Sale', trigger: 'Bàn giao', indent: 0 });

    if (workflowSteps.warranty_procedure) {
      tasks.push({ title: 'Thủ tục bảo hành', assignee: '—', trigger: 'Nghiệm thu', indent: 0 });
      if (workflowSteps.warranty_has_guarantee) {
        tasks.push({ title: 'Làm BL bảo hành', assignee: 'Kế toán', trigger: '', indent: 1 });
      }
      tasks.push({ title: 'Làm hồ sơ bảo hành', assignee: 'Sale', trigger: '', indent: 1 });
    }

    // Thủ tục thanh toán (luôn có)
    tasks.push({ title: 'Thủ tục thanh toán', assignee: '—', trigger: 'Nghiệm thu', indent: 0 });
    tasks.push({ title: 'Xuất hoá đơn', assignee: 'Kế toán', trigger: '', indent: 1 });
    tasks.push({ title: 'Giấy đề nghị thanh toán', assignee: 'Sale', trigger: '', indent: 1 });
    if (workflowSteps.payment_other_docs) {
      tasks.push({ title: 'Các giấy tờ khác', assignee: 'Sale', trigger: '', indent: 1 });
    }

    tasks.push({ title: 'Thu hồi công nợ (mỗi đợt XHĐ)', assignee: 'Sale', trigger: 'Xuất HĐ', indent: 0 });

    return tasks;
  }, [workflowSteps, lineItems]);

  // Manual task handlers (legacy)
  const handleAddCustomTask = () => {
    setCustomTasks(prev => [...prev, {
      title: '',
      description: '',
      assignees: [],
      duration_days: 1,
      base_date_type: 'signed_date'
    } as Partial<ContractFormTaskItem>]);
    setShowManualTasks(true);
  };
  const handleRemoveCustomTask = (index: number) => {
    setCustomTasks(prev => prev.filter((_, i) => i !== index));
  };
  const updateCustomTask = (index: number, field: keyof ContractFormTaskItem, value: any) => {
    setCustomTasks(prev => prev.map((t, i) => i === index ? { ...t, [field]: value } : t));
  };

  const sortedEmployees = useMemo(() => {
    if (!employees || !profile) return employees;
    return [...employees].sort((a, b) => {
      const aIsMe = (a as any).profile_id === profile.id || a.id === profile.employeeId;
      const bIsMe = (b as any).profile_id === profile.id || b.id === profile.employeeId;
      if (aIsMe && !bIsMe) return -1;
      if (!aIsMe && bIsMe) return 1;
      return 0;
    });
  }, [employees, profile]);

  return (
    <div className="space-y-8 animate-in fade-in duration-500">

      {/* HEADER */}
      <div className="bg-gradient-to-r from-indigo-50 to-violet-50 dark:from-indigo-900/20 dark:to-violet-900/20 p-5 rounded-2xl border border-indigo-100 dark:border-indigo-900/30">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center text-white shrink-0">
            <Zap size={20} />
          </div>
          <div>
            <h3 className="text-sm font-black text-slate-900 dark:text-slate-100 uppercase tracking-widest">
              Quy trình thực hiện hợp đồng
            </h3>
            <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
              Tick chọn các bước áp dụng cho hợp đồng này. Hệ thống sẽ tự động tạo công việc tương ứng và gán cho đúng người.
            </p>
          </div>
        </div>
      </div>

      {/* ============== GIAI ĐOẠN KÝ KẾT ============== */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden">
        <div className="px-5 py-3 bg-amber-50 dark:bg-amber-900/10 border-b border-amber-100 dark:border-amber-900/20">
          <h4 className="text-xs font-black text-amber-700 dark:text-amber-400 uppercase tracking-widest">
            ① Giai đoạn Ký kết
          </h4>
        </div>
        <div className="p-4 space-y-1">
          <WorkflowCheckbox checked={true} onChange={() => {}} label="Ký hợp đồng" alwaysOn assignee="Mốc khởi đầu" />

          <WorkflowCheckbox
            checked={workflowSteps.guarantee_performance}
            onChange={v => toggleStep('guarantee_performance', v)}
            label="Làm BL thực hiện hợp đồng"
            sublabel="Kế toán làm thủ tục bảo lãnh thực hiện HĐ"
            assignee="Kế toán"
          />

          <WorkflowCheckbox
            checked={workflowSteps.advance_procedure}
            onChange={v => toggleStep('advance_procedure', v)}
            label="Thủ tục tạm ứng"
            sublabel="Phát sinh task cha + task con: BL tạm ứng, Đề nghị TƯ → Auto: Đòi tiền TƯ"
          >
            {/* Sub-checkboxes */}
            <WorkflowCheckbox
              checked={workflowSteps.advance_has_guarantee}
              onChange={v => toggleStep('advance_has_guarantee', v)}
              label="Làm BL tạm ứng"
              assignee="Kế toán"
              indent={1}
            />
            <WorkflowCheckbox
              checked={true}
              onChange={() => {}}
              label="Giấy đề nghị tạm ứng"
              alwaysOn
              assignee="Sale"
              indent={1}
            />
            {/* Số ngày hạn TƯ */}
            <div className="ml-8 pl-4 border-l-2 border-slate-200 dark:border-slate-700 py-2">
              <label className="flex items-center gap-3 px-3">
                <Clock size={14} className="text-slate-400 shrink-0" />
                <span className="text-xs font-semibold text-slate-600 dark:text-slate-400 whitespace-nowrap">Số ngày hạn tạm ứng:</span>
                <input
                  type="number"
                  min={1}
                  value={workflowSteps.advance_deadline_days}
                  onChange={e => setWorkflowSteps(prev => ({ ...prev, advance_deadline_days: parseInt(e.target.value) || 20 }))}
                  className="w-20 px-2 py-1 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm font-bold text-center focus:ring-2 focus:ring-indigo-500 text-slate-800 dark:text-slate-200"
                />
                <span className="text-xs text-slate-400">ngày</span>
              </label>
              <p className="text-[10px] text-amber-600 dark:text-amber-400 ml-3 mt-1 px-3 flex items-center gap-1">
                <Info size={10} /> Khi hoàn thành TƯ → Tự phát sinh task "Đòi tiền tạm ứng" với deadline này
              </p>
            </div>
          </WorkflowCheckbox>
        </div>
      </div>

      {/* ============== GIAI ĐOẠN TRIỂN KHAI ============== */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden">
        <div className="px-5 py-3 bg-sky-50 dark:bg-sky-900/10 border-b border-sky-100 dark:border-sky-900/20">
          <h4 className="text-xs font-black text-sky-700 dark:text-sky-400 uppercase tracking-widest">
            ② Giai đoạn Triển khai
          </h4>
        </div>
        <div className="p-4 space-y-1">
          <WorkflowCheckbox
            checked={workflowSteps.import_goods}
            onChange={v => toggleStep('import_goods', v)}
            label="Nhập hàng"
            sublabel={`Checklist tự động từ ${lineItems.filter(li => li.name).length} sản phẩm/dịch vụ của HĐ`}
            assignee="Sale"
          />

          <WorkflowCheckbox
            checked={workflowSteps.subcontract}
            onChange={v => toggleStep('subcontract', v)}
            label="Ký hợp đồng thầu phụ"
            assignee="Sale"
          />

          <WorkflowCheckbox
            checked={workflowSteps.implementation}
            onChange={v => toggleStep('implementation', v)}
            label="Triển khai thực hiện HĐ"
            sublabel={lineItems.filter(li => li.name).length > 1
              ? `Tự tạo ${lineItems.filter(li => li.name).length} task con theo đầu mục dịch vụ`
              : 'Dành cho HĐ dịch vụ — tạo task triển khai'}
            assignee="Sale"
          />

          <WorkflowCheckbox
            checked={true}
            onChange={() => {}}
            label="Bàn giao"
            sublabel={`Checklist = ${lineItems.filter(li => li.name).length} sản phẩm bàn giao`}
            alwaysOn
            assignee="Sale"
          />

          <WorkflowCheckbox
            checked={workflowSteps.training}
            onChange={v => toggleStep('training', v)}
            label="Đào tạo chuyển giao"
            sublabel="Kích hoạt sau khi Bàn giao"
            assignee="Sale"
          />
        </div>
      </div>

      {/* ============== GIAI ĐOẠN NGHIỆM THU & THANH TOÁN ============== */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden">
        <div className="px-5 py-3 bg-emerald-50 dark:bg-emerald-900/10 border-b border-emerald-100 dark:border-emerald-900/20">
          <h4 className="text-xs font-black text-emerald-700 dark:text-emerald-400 uppercase tracking-widest">
            ③ Giai đoạn Nghiệm thu & Thanh toán
          </h4>
        </div>
        <div className="p-4 space-y-1">
          <WorkflowCheckbox
            checked={true}
            onChange={() => {}}
            label="Nghiệm thu thanh lý"
            alwaysOn
            assignee="Sale"
          />

          <WorkflowCheckbox
            checked={workflowSteps.warranty_procedure}
            onChange={v => toggleStep('warranty_procedure', v)}
            label="Thủ tục bảo hành"
            sublabel="BL bảo hành (KT) + Hồ sơ bảo hành (Sale)"
          >
            <WorkflowCheckbox
              checked={workflowSteps.warranty_has_guarantee}
              onChange={v => toggleStep('warranty_has_guarantee', v)}
              label="Làm BL bảo hành"
              assignee="Kế toán"
              indent={1}
            />
            <WorkflowCheckbox
              checked={true}
              onChange={() => {}}
              label="Làm hồ sơ bảo hành"
              alwaysOn
              assignee="Sale"
              indent={1}
            />
          </WorkflowCheckbox>

          <WorkflowCheckbox
            checked={true}
            onChange={() => {}}
            label="Thủ tục thanh toán"
            sublabel="Xuất HĐ (KT) + Đề nghị TT (Sale) → Auto: Thu hồi công nợ mỗi đợt"
            alwaysOn
          >
            <WorkflowCheckbox checked={true} onChange={() => {}} label="Xuất hoá đơn" alwaysOn assignee="Kế toán" indent={1} />
            <WorkflowCheckbox checked={true} onChange={() => {}} label="Giấy đề nghị thanh toán" alwaysOn assignee="Sale" indent={1} />
            <WorkflowCheckbox
              checked={workflowSteps.payment_other_docs}
              onChange={v => toggleStep('payment_other_docs', v)}
              label="Các giấy tờ khác"
              assignee="Sale"
              indent={1}
            />
            <div className="ml-8 pl-4 border-l-2 border-slate-200 dark:border-slate-700 py-2 px-3">
              <p className="text-[10px] text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                <Zap size={10} /> Mỗi lần xuất HĐ VAT → Tự phát sinh 1 task "Thu hồi công nợ" riêng cho Sale
              </p>
            </div>
          </WorkflowCheckbox>

          <WorkflowCheckbox
            checked={true}
            onChange={() => {}}
            label="Hoàn thành"
            sublabel="Tự động khi tiền về đủ"
            alwaysOn
            assignee="Hệ thống"
          />
        </div>
      </div>

      {/* ============== XEM TRƯỚC TASK ============== */}
      <div className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl overflow-hidden">
        <div className="px-5 py-3 border-b border-slate-200 dark:border-slate-700 flex items-center gap-2">
          <Briefcase size={14} className="text-indigo-500" />
          <h4 className="text-xs font-black text-slate-700 dark:text-slate-300 uppercase tracking-widest">
            Xem trước task sẽ phát sinh
          </h4>
          <span className="ml-auto px-2 py-0.5 rounded-full bg-indigo-100 dark:bg-indigo-900/30 text-[10px] font-bold text-indigo-700 dark:text-indigo-400">
            {previewTasks.length} task
          </span>
        </div>
        <div className="p-3 max-h-80 overflow-y-auto custom-scrollbar">
          <div className="space-y-0.5">
            {previewTasks.map((task, i) => (
              <div
                key={i}
                className={`flex items-center gap-3 py-1.5 px-3 rounded-lg text-xs ${task.indent > 0 ? 'ml-6' : ''}`}
              >
                <span className={`w-5 text-right font-mono font-bold shrink-0 ${task.indent > 0 ? 'text-slate-300 dark:text-slate-600' : 'text-indigo-500 dark:text-indigo-400'}`}>
                  {task.indent > 0 ? '·' : `${i + 1}.`}
                </span>
                <span className={`flex-1 font-medium ${task.indent > 0 ? 'text-slate-500 dark:text-slate-400' : 'text-slate-700 dark:text-slate-300'}`}>
                  {task.title}
                </span>
                <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold shrink-0 ${
                  task.assignee === 'Kế toán'
                    ? 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400'
                    : task.assignee === 'Sale'
                    ? 'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400'
                    : 'bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-400'
                }`}>
                  {task.assignee}
                </span>
                {task.trigger && (
                  <span className="text-[9px] text-slate-400 dark:text-slate-500 font-medium shrink-0">
                    Khi: {task.trigger}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ============== TASK THỦ CÔNG BỔ SUNG ============== */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden">
        <button
          type="button"
          onClick={() => setShowManualTasks(!showManualTasks)}
          className="w-full px-5 py-3 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
        >
          <div className="flex items-center gap-2">
            {showManualTasks
              ? <ChevronDown size={14} className="text-slate-400" />
              : <ChevronRight size={14} className="text-slate-400" />
            }
            <h4 className="text-xs font-black text-slate-600 dark:text-slate-400 uppercase tracking-widest">
              Task thủ công bổ sung
            </h4>
            {customTasks.length > 0 && (
              <span className="px-1.5 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-[10px] font-bold text-slate-500 dark:text-slate-400">
                {customTasks.length}
              </span>
            )}
          </div>
          <span className="text-[10px] text-slate-400 dark:text-slate-500">Thêm task đặc biệt ngoài quy trình</span>
        </button>

        {showManualTasks && (
          <div className="p-4 pt-0 border-t border-slate-100 dark:border-slate-800">
            <div className="flex justify-end mb-3 pt-3">
              <button
                type="button"
                onClick={handleAddCustomTask}
                className="px-4 py-2 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400 rounded-lg text-xs font-bold hover:bg-indigo-100 dark:hover:bg-indigo-900/50 transition-all flex items-center gap-2"
              >
                <Plus size={14} /> Thêm việc
              </button>
            </div>

            {customTasks.length === 0 ? (
              <div className="text-center py-6 rounded-xl border border-dashed border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800">
                <p className="text-xs text-slate-400 dark:text-slate-500 font-medium">Chưa có task thủ công nào</p>
              </div>
            ) : (
              <div className="space-y-3">
                {customTasks.map((task, index) => (
                  <div key={index} className="grid grid-cols-1 md:grid-cols-12 gap-3 p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 items-start">
                    <div className="md:col-span-4 space-y-1">
                      <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Tên <span className="text-rose-500">*</span></label>
                      <input
                        type="text"
                        value={task.title}
                        onChange={e => updateCustomTask(index, 'title', e.target.value)}
                        placeholder="Tên công việc..."
                        className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 text-slate-800 dark:text-slate-200"
                      />
                    </div>
                    <div className="md:col-span-3 space-y-1">
                      <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Người TH</label>
                      <SearchableSelect
                        value={task.assignees?.[0] || null}
                        onChange={id => updateCustomTask(index, 'assignees', id ? [id] : [])}
                        initialOptions={sortedEmployees.map(emp => ({
                          id: (emp as any).profile_id || emp.id,
                          name: emp.name
                        }))}
                        onSearch={async q => {
                          const lower = q.toLowerCase();
                          return sortedEmployees.filter(e => e.name.toLowerCase().includes(lower)).map(emp => ({
                            id: (emp as any).profile_id || emp.id,
                            name: emp.name
                          }));
                        }}
                        placeholder="-- Chọn --"
                      />
                    </div>
                    <div className="md:col-span-2 space-y-1">
                      <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Số ngày</label>
                      <input
                        type="number"
                        min={0}
                        value={task.duration_days ?? 1}
                        onChange={e => updateCustomTask(index, 'duration_days', parseInt(e.target.value) || 0)}
                        className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 text-slate-800 dark:text-slate-200"
                      />
                    </div>
                    <div className="md:col-span-2 space-y-1">
                      <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Kể từ</label>
                      <select
                        value={task.base_date_type || 'signed_date'}
                        onChange={e => updateCustomTask(index, 'base_date_type', e.target.value)}
                        className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 text-slate-800 dark:text-slate-200"
                      >
                        <option value="signed_date">Ký HĐ</option>
                        <option value="advance_completed">Xong TƯ</option>
                        <option value="handover_date">Bàn giao</option>
                        <option value="acceptance_date">Nghiệm thu</option>
                        <option value="invoice_date">Xuất HĐ</option>
                        <option value="completed_date">Hoàn thành</option>
                        <option value="current_date">Ngay lập tức</option>
                      </select>
                    </div>
                    <div className="md:col-span-1 flex items-end justify-end pb-1">
                      <button
                        type="button"
                        onClick={() => handleRemoveCustomTask(index)}
                        className="p-2 text-rose-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/30 rounded-lg transition-all"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
