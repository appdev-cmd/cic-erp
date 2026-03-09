import { dataClient as supabase } from '../lib/dataClient';
import { UnitService, EmployeeService, PaymentService } from './index';

// ─── Cache: Tránh gọi DB mỗi lần mount component ───────────
let cachedContext: string | null = null;
let cachedAt: number = 0;
const CACHE_TTL = 5 * 60 * 1000; // 5 phút

export const invalidateBusinessContext = () => {
    cachedContext = null;
    cachedAt = 0;
};

/**
 * Tính doanh thu từ payments (giống logic Dashboard/ContractService.getStatsFallback)
 * Revenue = SUM(payments 'Đã xuất HĐ' | 'Tiền về' | 'Paid') / VAT divisor
 * Fallback to actual_revenue nếu không có payments
 */
const calculateRevenue = (contract: any): number => {
    const vatRate = contract.vat_rate ?? 10;
    const hasVat = contract.has_vat !== false;
    const vatDivisor = hasVat && vatRate > 0 ? (1 + vatRate / 100) : 1;

    const payments: any[] = contract.payments || [];
    // Only count VAT_INVOICE vouchers as revenue (not RECEIPT which is cash received)
    const revenuePayments = payments.filter(
        (p: any) => p.voucher_type === 'VAT_INVOICE' &&
            ['Đã xuất HĐ', 'Đã giao KH', 'Tiền về', 'Paid'].includes(p.status)
    );

    if (revenuePayments.length > 0) {
        const revGross = revenuePayments.reduce((sum: number, p: any) => sum + (Number(p.amount) || 0), 0);
        return Math.round(revGross / vatDivisor);
    }

    // Fallback: actual_revenue (field cũ, có thể chưa cập nhật)
    return contract.actual_revenue || 0;
};

export const getBusinessContext = async (): Promise<string> => {
    // Trả về cache nếu còn hạn
    if (cachedContext && Date.now() - cachedAt < CACHE_TTL) {
        return cachedContext;
    }

    try {
        // Parallel fetch: Units, People, Payments Stats, and Contracts WITH payments
        const [units, people, paymentsStats, contractRes] = await Promise.all([
            UnitService.getAll(),
            EmployeeService.getAll(),
            PaymentService.getStats({}),
            supabase.from('contracts').select(
                'id, unit_id, employee_id, value, actual_revenue, status, vat_rate, has_vat, payments(amount, paid_amount, status, payment_type, voucher_type)'
            )
        ]);

        const allContracts = contractRes.data || [];

        // --- 1. Processing Unit Performance ---
        const unitMap = new Map<string, string>();
        units.forEach(u => unitMap.set(u.id, u.name));

        const unitStats: Record<string, { revenue: number; value: number; count: number }> = {};

        allContracts.forEach((c: any) => {
            const uId = c.unit_id;
            if (uId && unitMap.has(uId)) {
                if (!unitStats[uId]) unitStats[uId] = { revenue: 0, value: 0, count: 0 };
                unitStats[uId].revenue += calculateRevenue(c);
                unitStats[uId].value += c.value || 0;
                unitStats[uId].count += 1;
            }
        });

        const topUnits = Object.entries(unitStats)
            .map(([id, stat]) => ({ name: unitMap.get(id) || id, ...stat }))
            .sort((a, b) => b.revenue - a.revenue)
            .slice(0, 5);

        // --- 2. Processing Sales Performance ---
        const personMap = new Map<string, string>();
        people.forEach(p => personMap.set(p.id, p.name));

        const personStats: Record<string, { revenue: number; value: number; count: number }> = {};

        allContracts.forEach((c: any) => {
            const pId = c.employee_id;
            if (pId && personMap.has(pId)) {
                if (!personStats[pId]) personStats[pId] = { revenue: 0, value: 0, count: 0 };
                personStats[pId].revenue += calculateRevenue(c);
                personStats[pId].value += c.value || 0;
                personStats[pId].count += 1;
            }
        });

        const topSales = Object.entries(personStats)
            .map(([id, stat]) => ({ name: personMap.get(id) || id, ...stat }))
            .sort((a, b) => b.revenue - a.revenue)
            .slice(0, 5); // Top 5 Salespeople

        // Formatters
        const formatCurrency = (val: number) => new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 }).format(val);
        const totalRevenue = allContracts.reduce((sum, c: any) => sum + calculateRevenue(c), 0);
        const totalValue = allContracts.reduce((sum, c: any) => sum + (c.value || 0), 0);

        // --- Construct Text ---
        let report = `=== BÁO CÁO QUẢN TRỊ THÔNG MINH (Cập nhật: ${new Date().toLocaleString('vi-VN')}) ===\n\n`;

        report += `1. TỔNG QUAN TOÀN CÔNG TY:\n`;
        report += `- Tổng doanh thu thực tế: ${formatCurrency(totalRevenue)}\n`;
        report += `- Tổng giá trị ký kết: ${formatCurrency(totalValue)}\n`;
        report += `- Tổng số hợp đồng: ${allContracts.length}\n`;
        report += `- Dòng tiền đã về: ${formatCurrency(paymentsStats.cashReceivedAmount)}\n`;
        report += `- Đã xuất hóa đơn: ${formatCurrency(paymentsStats.invoicedAmount)}\n\n`;

        report += `2. TOP 5 ĐƠN VỊ XUẤT SẮC NHẤT (DOANH THU):\n`;
        topUnits.forEach((u, idx) => {
            report += `   ${idx + 1}. ${u.name}: ${formatCurrency(u.revenue)} (SL: ${u.count} HĐ)\n`;
        });
        report += `\n`;

        report += `3. TOP 5 NHÂN SỰ XUẤT SẮC NHẤT:\n`;
        topSales.forEach((p, idx) => {
            report += `   ${idx + 1}. ${p.name}: ${formatCurrency(p.revenue)}\n`;
        });
        report += `\n`;

        report += `4. HƯỚNG DẪN TRẢ LỜI:\n`;
        report += `- Khi người dùng hỏi "Ai làm việc hiệu quả nhất?", hãy dùng dữ liệu Top Nhân Sự.\n`;
        report += `- Khi người dùng hỏi "Phòng ban nào doanh thu cao nhất?", hãy dùng dữ liệu Top Đơn Vị.\n`;
        report += `- Dữ liệu trên LÀ CHÍNH XÁC VÀ TUYỆT ĐỐI. Không được tự bịa đặt số liệu.\n`;
        report += `- Nếu hỏi về đơn vị không có trong Top 5, hãy nói "Hiện tại đơn vị này chưa lọt vào Top 5 doanh thu, vui lòng xem chi tiết trên Dashboard".\n`;

        // Lưu cache
        cachedContext = report;
        cachedAt = Date.now();
        return report;

    } catch (error) {
        console.error("Context Advanced Fetch Error", error);
        return "⚠️ (Hệ thống dữ liệu đang cập nhật, vui lòng hỏi lại sau ít phút)";
    }
};
