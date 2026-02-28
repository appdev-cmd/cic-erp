import { dataClient as supabase } from '../lib/dataClient';

export interface AuditLog {
    id: string;
    user_id: string | null;
    table_name: string;
    record_id: string;
    action: string;
    old_data: any | null;
    new_data: any | null;
    comment: string | null;
    created_at: string;
    // Joined fields
    user_name?: string;
}

// Simple in-memory cache for user profiles to avoid repeated queries
const profileCache = new Map<string, string>();

/**
 * Service để quản lý Audit Logs - lịch sử tác động
 */
export const AuditLogService = {
    /**
     * Lấy danh sách audit logs cho một record cụ thể
     * Include thông tin người thực hiện từ profiles
     */
    async getByRecordId(tableName: string, recordId: string): Promise<AuditLog[]> {
        try {
            // Query audit_logs
            const { data, error } = await supabase
                .from('audit_logs')
                .select('*')
                .eq('table_name', tableName)
                .eq('record_id', recordId)
                .order('created_at', { ascending: false })
                .limit(20);

            if (error) {
                console.error('Error fetching audit logs:', error);
                return [];
            }

            if (!data || data.length === 0) return [];

            // Collect unique user IDs to batch lookup
            const userIds = [...new Set(
                data
                    .map((log: any) => log.user_id)
                    .filter((id: string | null) => id && !profileCache.has(id))
            )] as string[];

            // Batch fetch user names from profiles
            if (userIds.length > 0) {
                const { data: profiles } = await supabase
                    .from('profiles')
                    .select('id, full_name')
                    .in('id', userIds);

                if (profiles) {
                    for (const p of profiles) {
                        profileCache.set(p.id, p.full_name || 'Người dùng');
                    }
                }
            }

            // Map data with resolved user names
            return data.map((log: any) => ({
                ...log,
                user_name: log.user_id
                    ? (profileCache.get(log.user_id) || 'Người dùng')
                    : 'Hệ thống'
            }));
        } catch (err) {
            console.error('AuditLogService.getByRecordId error:', err);
            return [];
        }
    },

    /**
     * Tạo audit log entry mới
     * Thường được gọi từ các service khác khi có action xảy ra
     */
    async create(log: Omit<AuditLog, 'id' | 'created_at' | 'user_name'>): Promise<AuditLog | null> {
        try {
            const { data, error } = await supabase
                .from('audit_logs')
                .insert(log)
                .select()
                .single();

            if (error) {
                console.error('[AuditLogService] Error creating audit log:', error);
                return null;
            }

            return data;
        } catch (err) {
            console.error('[AuditLogService] Exception in create:', err);
            return null;
        }
    },

    /**
     * Format action thành text tiếng Việt thân thiện
     * Phân tích old_data vs new_data để mô tả chính xác thay đổi
     */
    formatAction(action: string, oldData?: any, newData?: any): string {
        // Status translation map - Vietnamese
        const statusLabels: Record<string, string> = {
            'Processing': 'Đang thực hiện',
            'Suspended': 'Tạm dừng',
            'Acceptance': 'Nghiệm thu',
            'Liquidated': 'Thanh lý',
            'Completed': 'Hoàn thành',
            // Legacy
            'Active': 'Đang thực hiện',
            'Pending': 'Đang thực hiện',
            'Reviewing': 'Đang thực hiện',
            'Expired': 'Hoàn thành',
            'Draft': 'Đang thực hiện',
            'Terminated': 'Hoàn thành',
        };

        const stageLabels: Record<string, string> = {
            'Signed': 'Đã ký',
            'Advanced': 'Đã tạm ứng',
            'Guaranteed': 'Đã bảo lãnh',
            'InputOrdered': 'Đã đặt hàng đầu vào',
            'Implementation': 'Đang triển khai',
            'Completed': 'Hoàn thành',
            'Invoiced': 'Đã xuất hóa đơn'
        };

        // Human-readable field labels for showing what changed
        const fieldLabels: Record<string, string> = {
            title: 'Tiêu đề',
            value: 'Giá trị HĐ',
            status: 'Trạng thái',
            stage: 'Giai đoạn',
            signed_date: 'Ngày ký',
            start_date: 'Ngày bắt đầu',
            end_date: 'Ngày kết thúc',
            party_a: 'Bên A',
            party_b: 'Bên B',
            customer_id: 'Khách hàng',
            unit_id: 'Đơn vị',
            salesperson_id: 'Nhân viên phụ trách',
            contract_type: 'Loại HĐ',
            payment_terms: 'Điều khoản thanh toán',
            notes: 'Ghi chú',
            line_items: 'Hạng mục',
            payment_phases: 'Đợt thanh toán',
            milestones: 'Mốc triển khai',
            admin_costs: 'Chi phí quản lý',
            invoiced_amount: 'Đã xuất HĐ',
            actual_revenue: 'Đã thu tiền',
            draft_url: 'Link dự thảo',
            legal_approved: 'Pháp lý duyệt',
            finance_approved: 'Tài chính duyệt',
            revenue_schedules: 'Lịch xuất HĐ doanh thu',
        };

        // Fields to ignore when computing changed fields
        const ignoreFields = new Set([
            'id', 'created_at', 'updated_at', 'created_by',
        ]);

        const translateStatus = (s: string) => statusLabels[s] || s;
        const translateStage = (s: string) => stageLabels[s] || s;

        switch (action) {
            case 'INSERT': {
                const title = newData?.title;
                return title ? `Tạo mới hợp đồng "${title}"` : 'Tạo mới hợp đồng';
            }

            case 'UPDATE': {
                if (!oldData || !newData) return 'Cập nhật thông tin';

                // --- PRIORITY CHECKS (specific workflow actions) ---

                // Legal approval
                if (!oldData.legal_approved && newData.legal_approved === true) {
                    return '✅ Pháp lý đã duyệt';
                }
                // Finance approval
                if (!oldData.finance_approved && newData.finance_approved === true) {
                    return '✅ Tài chính đã duyệt';
                }
                // Submit for review
                if (oldData.status === 'Draft' && newData.status === 'Pending_Review') {
                    return '📤 Gửi duyệt (Pháp lý + Tài chính song song)';
                }
                // Both approved
                if (oldData.status === 'Pending_Review' && newData.status === 'Both_Approved') {
                    return '🎉 Cả hai bên đã duyệt xong';
                }
                // Status change
                if (oldData.status !== newData.status) {
                    return `Chuyển trạng thái: ${translateStatus(oldData.status)} → ${translateStatus(newData.status)}`;
                }
                // Stage change
                if (oldData.stage !== newData.stage) {
                    return `Chuyển giai đoạn: ${translateStage(oldData.stage)} → ${translateStage(newData.stage)}`;
                }
                // Review status change
                if (oldData.review_status !== newData.review_status) {
                    const statusMap: Record<string, string> = {
                        'PENDING_LEGAL': 'Chờ Pháp lý duyệt',
                        'LEGAL_APPROVED': 'Pháp lý đã duyệt',
                        'PENDING_FINANCE': 'Chờ Tài chính duyệt',
                        'FINANCE_APPROVED': 'Tài chính đã duyệt',
                        'REJECTED': 'Từ chối'
                    };
                    return `Duyệt: ${statusMap[newData.review_status] || newData.review_status}`;
                }
                // Draft URL added
                if (!oldData.draft_url && newData.draft_url) {
                    return 'Gửi dự thảo cho Pháp lý xem xét';
                }

                // --- GENERIC: list changed fields ---
                const changedFields: string[] = [];
                for (const key of Object.keys(newData)) {
                    if (ignoreFields.has(key)) continue;
                    const oldVal = JSON.stringify(oldData[key] ?? null);
                    const newVal = JSON.stringify(newData[key] ?? null);
                    if (oldVal !== newVal && fieldLabels[key]) {
                        changedFields.push(fieldLabels[key]);
                    }
                }

                if (changedFields.length > 0) {
                    const shown = changedFields.slice(0, 3).join(', ');
                    const more = changedFields.length > 3 ? ` (+${changedFields.length - 3} mục)` : '';
                    return `Cập nhật: ${shown}${more}`;
                }

                return 'Cập nhật thông tin';
            }

            case 'DELETE': {
                const title = oldData?.title;
                return title ? `Xóa hợp đồng "${title}"` : 'Xóa hợp đồng';
            }

            case 'APPROVE_LEGAL':
                return '✅ Pháp lý phê duyệt nội dung';
            case 'APPROVE_FINANCE':
                return '✅ Tài chính phê duyệt';
            case 'REJECT':
                return '❌ Từ chối phê duyệt';
            case 'SUBMIT_LEGAL':
                return '📤 Gửi duyệt Pháp lý';
            default:
                return action;
        }
    },

    /**
     * Format thời gian thành chuỗi ngày/giờ tiếng Việt
     */
    formatDateTime(dateString: string): { date: string; time: string } {
        const date = new Date(dateString);
        return {
            date: date.toLocaleDateString('vi-VN', {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric'
            }),
            time: date.toLocaleTimeString('vi-VN', {
                hour: '2-digit',
                minute: '2-digit'
            })
        };
    }
};
