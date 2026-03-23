import React, { useState, useEffect } from 'react';
import PaymentForm from '../PaymentForm';
import { PaymentService, ContractService, TaskService } from '../../services';
import { toast } from 'sonner';

export const TaskActionHandler: React.FC = () => {
  const [action, setAction] = useState<{ task: any, type: string, entityId: string, entityType: string } | null>(null);
  
  // Validation data for PaymentForm
  const [contractLimit, setContractLimit] = useState<number>(0);
  const [existingInvoiceTotal, setExistingInvoiceTotal] = useState<number>(0);
  const [existingReceiptTotal, setExistingReceiptTotal] = useState<number>(0);

  useEffect(() => {
    const handleTaskAction = async (e: any) => {
      const detail = e.detail;
      const { task, actionType, entityId, entityType } = detail;
      
      if (!actionType || !entityId) return;

      // If it's a finance action, load limits before showing form
      if (actionType === 'OPEN_VAT_INVOICE_MODAL' || actionType === 'OPEN_PAYMENT_MODAL') {
        try {
          const [contract, payments] = await Promise.all([
            ContractService.getById(entityId),
            PaymentService.getByContract(entityId)
          ]);

          if (contract) {
            setContractLimit(contract.acceptanceValue || contract.value || 0);
          }
          
          const vatInvoices = payments.filter((p: any) => p.voucherType === 'VAT_INVOICE');
          const receipts = payments.filter((p: any) => p.voucherType === 'RECEIPT');
          
          setExistingInvoiceTotal(vatInvoices.reduce((sum: number, p: any) => sum + p.amount, 0));
          setExistingReceiptTotal(receipts.reduce((sum: number, p: any) => sum + p.amount, 0));
          
          setAction(detail);
        } catch (error) {
          toast.error('Lỗi khi tải dữ liệu hợp đồng');
        }
      } else {
        // Handle other actions directly if needed
        setAction(detail);
      }
    };

    window.addEventListener('task-action', handleTaskAction);
    return () => window.removeEventListener('task-action', handleTaskAction);
  }, []);

  if (!action) return null;

  const handleClose = () => setAction(null);

  const handleSavePayment = async (data: any) => {
    try {
      const payload = { ...data, contractId: action.entityId, customerId: data.customerId };
      await PaymentService.create(payload);
      toast.success('Lưu phiếu thành công!');
      
      // Emit event so other lists can refresh
      window.dispatchEvent(new CustomEvent('payment-changed', { detail: { record: { contract_id: action.entityId }, source: 'local' } }));
      
      // IMPORTANT: Don't need to manually complete the task here if `completion_trigger` engine logic is implemented.
      // But just to be sure, we can also trigger a task completion check event or complete it here if its trigger matches.
      
      handleClose();
    } catch (e: any) {
      toast.error('Lỗi lưu phiếu: ' + (e.message || 'Unknown'));
    }
  };

  const isFinanceAction = action.type === 'OPEN_VAT_INVOICE_MODAL' || action.type === 'OPEN_PAYMENT_MODAL';

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 md:p-8 animate-in fade-in duration-200">
      {isFinanceAction && (
        <PaymentForm
            initialVoucherType={action.type === 'OPEN_VAT_INVOICE_MODAL' ? 'VAT_INVOICE' : 'EXPENSE'}
            initialContractId={action.entityId}
            onSave={handleSavePayment}
            onCancel={handleClose}
            contractValue={contractLimit}
            existingInvoiceTotal={existingInvoiceTotal}
            existingReceiptTotal={existingReceiptTotal}
            isInsidePanel={false}
        />
      )}
      
      {/* Other modals could go here in the future */}
      {!isFinanceAction && (
        <div className="bg-white dark:bg-slate-900 p-6 rounded-xl w-full max-w-md">
           <h3 className="font-bold text-lg mb-4 text-slate-900 dark:text-slate-100">Hành động chưa được hỗ trợ</h3>
           <p className="text-sm text-slate-500 mb-6">Hành động <code>{action.type}</code> chưa được tích hợp UI.</p>
           <div className="flex justify-end">
              <button onClick={handleClose} className="px-4 py-2 bg-slate-200 dark:bg-slate-800 rounded-lg text-sm font-bold">Đóng</button>
           </div>
        </div>
      )}
    </div>
  );
};
