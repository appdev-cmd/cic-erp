import { dataClient as supabase } from '../../lib/dataClient';
import { TaskService } from '../taskService';
import { EmployeeService } from '../employeeService';
import { ContractService } from '../contractService';
import { fmtMoney } from './openclaw/tools/_helpers';

export interface ProactiveAlert {
  id: string;
  type: 'bottleneck' | 'financial' | 'operational';
  severity: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  message: string;
  suggestedAction?: string;
  data?: any;
  createdAt: string;
}

export const ProactiveService = {
  /**
   * Chạy phân tích tổng thể để phát hiện bất thường.
   * Thường được trigger bằng cronjob mỗi sáng.
   */
  async runDailyAnalysis(): Promise<ProactiveAlert[]> {
    const alerts: ProactiveAlert[] = [];
    const today = new Date().toISOString().split('T')[0];

    // 1. Phân tích tài chính (Công nợ & Doanh thu)
    try {
      const [paymentsRes, contractsRes] = await Promise.all([
        supabase.from('payments')
          .select('id, amount, paid_amount, due_date')
          .in('status', ['Chưa thanh toán', 'Đã xuất HĐ'])
          .lt('due_date', today),
        supabase.from('contracts')
          .select('id, value, end_date')
          .eq('status', 'Processing')
          .lt('end_date', today)
      ]);

      const overduePayments = paymentsRes.data || [];
      const totalDebt = overduePayments.reduce((sum, p) => sum + ((p.amount || 0) - (p.paid_amount || 0)), 0);

      if (totalDebt > 100_000_000) { // Cảnh báo nếu công nợ quá hạn > 100M
        alerts.push({
          id: `debt_${Date.now()}`,
          type: 'financial',
          severity: totalDebt > 500_000_000 ? 'critical' : 'high',
          title: 'Cảnh báo Công nợ quá hạn cao',
          message: `Hiện có ${overduePayments.length} khoản thanh toán quá hạn với tổng số tiền ${fmtMoney(totalDebt)}.`,
          suggestedAction: 'Giao task thu hồi công nợ cho phòng TCKT.',
          createdAt: new Date().toISOString()
        });
      }

      const overdueContracts = contractsRes.data || [];
      if (overdueContracts.length > 5) { // Quá 5 hợp đồng trễ hạn
        alerts.push({
          id: `contract_${Date.now()}`,
          type: 'operational',
          severity: 'high',
          title: 'Cảnh báo Hợp đồng chậm tiến độ',
          message: `Có ${overdueContracts.length} hợp đồng đang xử lý nhưng đã quá ngày kết thúc dự kiến.`,
          suggestedAction: 'Yêu cầu các Chủ nhiệm dự án cập nhật tình hình hoặc gia hạn.',
          createdAt: new Date().toISOString()
        });
      }
    } catch (e) {
      console.error('Lỗi phân tích tài chính:', e);
    }

    // 2. Phân tích quá tải nhân sự (Bottlenecks)
    try {
      const tasksRes = await supabase.from('tasks')
        .select('id, assigned_to, due_date')
        .lt('due_date', today)
        .is('completed_at', null);
      
      const overdueTasks = tasksRes.data || [];
      const workloadMap: Record<string, number> = {};
      
      overdueTasks.forEach(t => {
        if (t.assigned_to) {
          workloadMap[t.assigned_to] = (workloadMap[t.assigned_to] || 0) + 1;
        }
      });

      const overloadedUserIds = Object.entries(workloadMap)
        .filter(([_, count]) => count > 10) // Quá 10 tasks trễ
        .map(([id]) => id);

      if (overloadedUserIds.length > 0) {
        alerts.push({
          id: `bottleneck_${Date.now()}`,
          type: 'bottleneck',
          severity: 'high',
          title: 'Phát hiện Điểm nghẽn nhân sự (Bottleneck)',
          message: `Có ${overloadedUserIds.length} nhân viên đang bị quá tải nghiêm trọng (>10 tasks trễ hạn).`,
          suggestedAction: 'Gọi AI Planning Agent để đánh giá và tái phân bổ công việc.',
          data: { overloadedUserIds },
          createdAt: new Date().toISOString()
        });
      }
    } catch (e) {
      console.error('Lỗi phân tích quá tải:', e);
    }

    // Ghi log vào system (có thể mở rộng push notification ở đây)
    if (alerts.length > 0) {
      console.log(`[ProactiveService] Đã phát hiện ${alerts.length} bất thường.`);
      // TODO: Save to a notifications table or send via push/websocket
    }

    return alerts;
  }
};
