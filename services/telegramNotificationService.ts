/**
 * Telegram Notification Service
 * ==============================
 * Gửi thông báo qua Telegram khi có thay đổi hợp đồng/tài chính.
 * 
 * Người nhận:
 * - Nhân viên phụ trách hợp đồng (employee_id + employee_allocations)
 * - Ban Giám đốc (role = Leadership)
 * - Quản trị viên (role = Admin)
 * 
 * Cơ chế: Fire-and-forget — không ảnh hưởng CRUD operations.
 */

import { dataClient as supabase } from '../lib/dataClient';

// ============================================================================
// TYPES
// ============================================================================

interface NotifyPayload {
    chat_ids: string[];
    message: string;
    parse_mode?: 'HTML' | 'Markdown';
}

type ContractEventType = 'created' | 'updated' | 'deleted' | 'status_changed';
type PaymentEventType = 'created' | 'updated' | 'deleted';

interface ContractNotifyData {
    eventType: ContractEventType;
    contractTitle: string;
    contractId: string;
    value?: number;
    employeeName?: string;
    unitName?: string;
    oldStatus?: string;
    newStatus?: string;
    changedFields?: string[];
    changedBy?: string;
}

interface PaymentNotifyData {
    eventType: PaymentEventType;
    contractTitle: string;
    contractId: string;
    amount: number;
    status?: string;
    paymentType?: 'Revenue' | 'Expense';
    oldStatus?: string;
    newStatus?: string;
    changedBy?: string;
}

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Format số tiền thành dạng đọc được (VD: 5,200,000,000 → "5.2 tỷ")
 */
function formatMoney(amount: number): string {
    if (!amount || amount === 0) return '0';
    if (amount >= 1_000_000_000) {
        return `${(amount / 1_000_000_000).toFixed(1)} tỷ`;
    }
    if (amount >= 1_000_000) {
        return `${(amount / 1_000_000).toFixed(0)} triệu`;
    }
    return new Intl.NumberFormat('vi-VN').format(amount);
}

/**
 * Dịch status sang tiếng Việt
 */
function translateStatus(status: string): string {
    const map: Record<string, string> = {
        'Draft': 'Nháp',
        'Pending_Review': 'Chờ duyệt',
        'Both_Approved': 'Đã duyệt',
        'Pending_Sign': 'Chờ ký',
        'Processing': 'Đang thực hiện',
        'Suspended': 'Tạm dừng',
        'Acceptance': 'Nghiệm thu',
        'Liquidated': 'Thanh lý',
        'Completed': 'Hoàn thành',
        'Tạm ứng': 'Tạm ứng',
        'Đã xuất HĐ': 'Đã xuất HĐ',
        'Tiền về': 'Tiền về',
    };
    return map[status] || status;
}

/**
 * Timestamp hiện tại (giờ VN)
 */
function vnTimestamp(): string {
    return new Date().toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' });
}

// ============================================================================
// RECIPIENT RESOLUTION
// ============================================================================

/**
 * Lấy danh sách Telegram Chat ID của người nhận thông báo cho một hợp đồng.
 * 
 * Người nhận:
 * 1. NV phụ trách chính (contract.employee_id)
 * 2. NV phân bổ (contract.employee_allocations[].employeeId)
 * 3. Ban Giám đốc (profiles.role = 'Leadership' → profiles.employee_id → employees.telegram)
 * 4. Admin (profiles.role = 'Admin' → profiles.employee_id → employees.telegram)
 */
async function getRecipientChatIds(contractId: string): Promise<string[]> {
    try {
        const chatIds = new Set<string>();

        // 1. Lấy thông tin hợp đồng để biết employee_id và employee_allocations
        const { data: contract } = await supabase
            .from('contracts')
            .select('employee_id, employee_allocations')
            .eq('id', contractId)
            .single();

        const relatedEmployeeIds: string[] = [];

        if (contract?.employee_id) {
            relatedEmployeeIds.push(contract.employee_id);
        }

        // Parse employee_allocations JSONB
        if (contract?.employee_allocations) {
            const allocations = typeof contract.employee_allocations === 'string'
                ? JSON.parse(contract.employee_allocations)
                : contract.employee_allocations;

            if (Array.isArray(allocations)) {
                for (const alloc of allocations) {
                    if (alloc.employeeId) {
                        relatedEmployeeIds.push(alloc.employeeId);
                    }
                }
            }
        }

        // 2. Lấy Chat ID của NV liên quan
        if (relatedEmployeeIds.length > 0) {
            const { data: employees } = await supabase
                .from('employees')
                .select('telegram')
                .in('id', relatedEmployeeIds)
                .not('telegram', 'is', null);

            if (employees) {
                for (const emp of employees) {
                    if (emp.telegram) chatIds.add(emp.telegram);
                }
            }
        }

        // 3. Lấy Chat ID của BGĐ + Admin
        // profiles.role IN ('Leadership', 'Admin') → lấy employee_id → employees.telegram
        const { data: adminProfiles } = await supabase
            .from('profiles')
            .select('employee_id')
            .in('role', ['Leadership', 'Admin'])
            .not('employee_id', 'is', null);

        if (adminProfiles && adminProfiles.length > 0) {
            const adminEmployeeIds = adminProfiles
                .map(p => p.employee_id)
                .filter((id): id is string => !!id);

            if (adminEmployeeIds.length > 0) {
                const { data: adminEmployees } = await supabase
                    .from('employees')
                    .select('telegram')
                    .in('id', adminEmployeeIds)
                    .not('telegram', 'is', null);

                if (adminEmployees) {
                    for (const emp of adminEmployees) {
                        if (emp.telegram) chatIds.add(emp.telegram);
                    }
                }
            }
        }

        return Array.from(chatIds);
    } catch (err) {
        console.error('[TelegramNotify] Error resolving recipients:', err);
        return [];
    }
}

// ============================================================================
// MESSAGE FORMATTING
// ============================================================================

function buildContractMessage(data: ContractNotifyData): string {
    const time = vnTimestamp();
    const value = data.value ? formatMoney(data.value) : '';

    switch (data.eventType) {
        case 'created':
            return [
                `📋 <b>Hợp đồng mới</b>`,
                ``,
                `📌 <b>${data.contractTitle}</b>`,
                value ? `💰 Giá trị ký: ${value}` : '',
                data.employeeName ? `👤 NV phụ trách: ${data.employeeName}` : '',
                data.unitName ? `🏢 Đơn vị: ${data.unitName}` : '',
                ``,
                `🕐 ${time}`,
                data.changedBy ? `✍️ Bởi: ${data.changedBy}` : '',
            ].filter(Boolean).join('\n');

        case 'status_changed':
            return [
                `🔄 <b>Chuyển trạng thái HĐ</b>`,
                ``,
                `📌 <b>${data.contractTitle}</b>`,
                `📊 ${translateStatus(data.oldStatus || '')} → <b>${translateStatus(data.newStatus || '')}</b>`,
                ``,
                `🕐 ${time}`,
                data.changedBy ? `✍️ Bởi: ${data.changedBy}` : '',
            ].filter(Boolean).join('\n');

        case 'updated':
            return [
                `✏️ <b>Cập nhật hợp đồng</b>`,
                ``,
                `📌 <b>${data.contractTitle}</b>`,
                data.changedFields?.length
                    ? `📝 Thay đổi: ${data.changedFields.join(', ')}`
                    : '',
                ``,
                `🕐 ${time}`,
                data.changedBy ? `✍️ Bởi: ${data.changedBy}` : '',
            ].filter(Boolean).join('\n');

        case 'deleted':
            return [
                `❌ <b>Xóa hợp đồng</b>`,
                ``,
                `📌 <b>${data.contractTitle}</b>`,
                value ? `💰 Giá trị: ${value}` : '',
                ``,
                `🕐 ${time}`,
                data.changedBy ? `✍️ Bởi: ${data.changedBy}` : '',
            ].filter(Boolean).join('\n');

        default:
            return `📋 Thay đổi hợp đồng: ${data.contractTitle}`;
    }
}

function buildPaymentMessage(data: PaymentNotifyData): string {
    const time = vnTimestamp();
    const amount = formatMoney(data.amount);
    const typeIcon = data.paymentType === 'Expense' ? '💸' : '💰';
    const typeLabel = data.paymentType === 'Expense' ? 'Chi' : 'Thu';

    switch (data.eventType) {
        case 'created':
            return [
                `${typeIcon} <b>Thanh toán mới (${typeLabel})</b>`,
                ``,
                `📌 HĐ: <b>${data.contractTitle}</b>`,
                `💵 Số tiền: ${amount}`,
                data.status ? `📊 Trạng thái: ${translateStatus(data.status)}` : '',
                ``,
                `🕐 ${time}`,
                data.changedBy ? `✍️ Bởi: ${data.changedBy}` : '',
            ].filter(Boolean).join('\n');

        case 'updated':
            return [
                `💳 <b>Cập nhật thanh toán</b>`,
                ``,
                `📌 HĐ: <b>${data.contractTitle}</b>`,
                `💵 Số tiền: ${amount}`,
                data.oldStatus && data.newStatus
                    ? `📊 ${translateStatus(data.oldStatus)} → <b>${translateStatus(data.newStatus)}</b>`
                    : data.status ? `📊 Trạng thái: ${translateStatus(data.status)}` : '',
                ``,
                `🕐 ${time}`,
                data.changedBy ? `✍️ Bởi: ${data.changedBy}` : '',
            ].filter(Boolean).join('\n');

        case 'deleted':
            return [
                `❌ <b>Xóa thanh toán</b>`,
                ``,
                `📌 HĐ: <b>${data.contractTitle}</b>`,
                `💵 Số tiền: ${amount}`,
                ``,
                `🕐 ${time}`,
                data.changedBy ? `✍️ Bởi: ${data.changedBy}` : '',
            ].filter(Boolean).join('\n');

        default:
            return `💰 Thay đổi thanh toán: ${data.contractTitle} — ${amount}`;
    }
}

// ============================================================================
// SEND TO EDGE FUNCTION
// ============================================================================

/**
 * Gửi thông báo qua Edge Function (fire-and-forget).
 * Không throw error — log warning nếu thất bại.
 */
async function sendNotification(payload: NotifyPayload): Promise<void> {
    try {
        if (!payload.chat_ids.length) {
            console.log('[TelegramNotify] Không có người nhận, bỏ qua');
            return;
        }

        const { data, error } = await supabase.functions.invoke('telegram-notify', {
            body: payload,
        });

        if (error) {
            console.warn('[TelegramNotify] Edge Function error:', error.message);
        } else {
            console.log(`[TelegramNotify] Sent: ${data?.sent || 0}/${payload.chat_ids.length}`);
        }
    } catch (err) {
        // Fire-and-forget: NEVER let notification errors break the app
        console.warn('[TelegramNotify] Failed silently:', err);
    }
}

// ============================================================================
// PUBLIC API
// ============================================================================

export const TelegramNotificationService = {
    /**
     * Thông báo thay đổi hợp đồng.
     * Gọi sau khi CRUD thành công.
     */
    async notifyContractChange(data: ContractNotifyData): Promise<void> {
        try {
            const chatIds = await getRecipientChatIds(data.contractId);
            if (chatIds.length === 0) return;

            const message = buildContractMessage(data);
            await sendNotification({ chat_ids: chatIds, message, parse_mode: 'HTML' });
        } catch (err) {
            console.warn('[TelegramNotify] Contract notification failed:', err);
        }
    },

    /**
     * Thông báo thay đổi thanh toán.
     * Gọi sau khi CRUD thành công.
     */
    async notifyPaymentChange(data: PaymentNotifyData): Promise<void> {
        try {
            const chatIds = await getRecipientChatIds(data.contractId);
            if (chatIds.length === 0) return;

            const message = buildPaymentMessage(data);
            await sendNotification({ chat_ids: chatIds, message, parse_mode: 'HTML' });
        } catch (err) {
            console.warn('[TelegramNotify] Payment notification failed:', err);
        }
    },
};
