import { dataClient as supabase } from '../lib/dataClient';
import { UnitService, EmployeeService, PaymentService } from './index';

// ─── Cache: Tránh gọi DB mỗi lần mount component ───────────
const cachedContexts: Record<string, { data: string; at: number }> = {};
const CACHE_TTL = 5 * 60 * 1000; // 5 phút

export const invalidateBusinessContext = (unitId?: string) => {
    if (unitId) {
        delete cachedContexts[unitId];
    } else {
        // Clear all
        for (const key in cachedContexts) delete cachedContexts[key];
    }
};

/**
 * Lấy doanh thu thực tế — ưu tiên actual_revenue (đã tính sẵn chính xác trên DB)
 * Fallback: tính từ payments nếu actual_revenue chưa có
 */
const calculateRevenue = (contract: any): number => {
    // Ưu tiên 1: actual_revenue (đã tính sẵn bởi trigger/Dashboard)
    if (contract.actual_revenue && contract.actual_revenue > 0) {
        return Number(contract.actual_revenue);
    }

    // Ưu tiên 2: Tính từ payments (VAT_INVOICE)
    const vatRate = contract.vat_rate ?? 10;
    const hasVat = contract.has_vat !== false;
    const vatDivisor = hasVat && vatRate > 0 ? (1 + vatRate / 100) : 1;

    const payments: any[] = contract.payments || [];
    const revenuePayments = payments.filter(
        (p: any) => p.voucher_type === 'VAT_INVOICE' &&
            ['Đã xuất HĐ', 'Đã giao KH', 'Tiền về', 'Paid'].includes(p.status)
    );

    if (revenuePayments.length > 0) {
        const revGross = revenuePayments.reduce((sum: number, p: any) => sum + (Number(p.amount) || 0), 0);
        return Math.round(revGross / vatDivisor);
    }

    return 0;
};

// ─── Helper: Xác định năm/quý từ signed_date ────────────
const getYear = (dateStr: string | null | undefined): number | null => {
    if (!dateStr) return null;
    const d = new Date(dateStr);
    return isNaN(d.getTime()) ? null : d.getFullYear();
};

const getQuarter = (dateStr: string | null | undefined): number | null => {
    if (!dateStr) return null;
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return null;
    return Math.ceil((d.getMonth() + 1) / 3);
};

const getMonth = (dateStr: string | null | undefined): number | null => {
    if (!dateStr) return null;
    const d = new Date(dateStr);
    return isNaN(d.getTime()) ? null : d.getMonth() + 1;
};

export const getBusinessContext = async (unitId?: string, userId?: string): Promise<string> => {
    const cacheKey = userId || unitId || 'global';
    const nowCache = Date.now();
    // Trả về cache nếu còn hạn
    if (cachedContexts[cacheKey] && nowCache - cachedContexts[cacheKey].at < CACHE_TTL) {
        return cachedContexts[cacheKey].data;
    }

    try {
        // Parallel fetch: Units, People, Payments Stats, and Contracts WITH payments
        const [units, people, paymentsStats, contractRes] = await Promise.all([
            UnitService.getAll(),
            EmployeeService.getAll(),
            PaymentService.getStats({}),
            supabase.from('contracts').select(
                'id, unit_id, employee_id, value, actual_revenue, status, vat_rate, has_vat, signed_date, start_date, end_date, payments(amount, paid_amount, status, payment_type, voucher_type)'
            )
        ]);

        const allContracts = contractRes.data || [];

        // --- Unit & Person Maps ---
        const unitMap = new Map<string, string>();
        units.forEach(u => unitMap.set(u.id, u.name));

        const personMap = new Map<string, string>();
        people.forEach(p => personMap.set(p.id, p.name));

        const formatCurrency = (val: number) => new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 }).format(val);

        // ═══════════════════════════════════════════════════════════
        // PHẦN 1 — TỔNG QUAN (TẤT CẢ THỜI GIAN)
        // ═══════════════════════════════════════════════════════════
        const totalRevenue = allContracts.reduce((sum, c: any) => sum + calculateRevenue(c), 0);
        const totalValue = allContracts.reduce((sum, c: any) => sum + (c.value || 0), 0);

        // Top 5 đơn vị (tất cả thời gian)
        const unitStatsAll: Record<string, { revenue: number; value: number; count: number }> = {};
        allContracts.forEach((c: any) => {
            const uId = c.unit_id;
            if (uId && unitMap.has(uId)) {
                if (!unitStatsAll[uId]) unitStatsAll[uId] = { revenue: 0, value: 0, count: 0 };
                unitStatsAll[uId].revenue += calculateRevenue(c);
                unitStatsAll[uId].value += c.value || 0;
                unitStatsAll[uId].count += 1;
            }
        });
        const topUnitsAll = Object.entries(unitStatsAll)
            .map(([id, stat]) => ({ name: unitMap.get(id) || id, ...stat }))
            .sort((a, b) => b.revenue - a.revenue)
            .slice(0, 5);

        // Top 5 nhân sự (tất cả thời gian)
        const personStatsAll: Record<string, { revenue: number; value: number; count: number }> = {};
        allContracts.forEach((c: any) => {
            const pId = c.employee_id;
            if (pId && personMap.has(pId)) {
                if (!personStatsAll[pId]) personStatsAll[pId] = { revenue: 0, value: 0, count: 0 };
                personStatsAll[pId].revenue += calculateRevenue(c);
                personStatsAll[pId].value += c.value || 0;
                personStatsAll[pId].count += 1;
            }
        });
        const topSalesAll = Object.entries(personStatsAll)
            .map(([id, stat]) => ({ name: personMap.get(id) || id, ...stat }))
            .sort((a, b) => b.revenue - a.revenue)
            .slice(0, 5);

        // ═══════════════════════════════════════════════════════════
        // PHẦN 2 — PHÂN TÍCH THEO NĂM (để AI trả lời "doanh thu năm X")
        // ═══════════════════════════════════════════════════════════
        const yearStats: Record<number, { revenue: number; value: number; count: number; byUnit: Record<string, { revenue: number; count: number }>; byPerson: Record<string, { revenue: number; count: number }> }> = {};

        allContracts.forEach((c: any) => {
            const year = getYear(c.signed_date) || getYear(c.start_date);
            if (!year) return;

            if (!yearStats[year]) {
                yearStats[year] = { revenue: 0, value: 0, count: 0, byUnit: {}, byPerson: {} };
            }

            const rev = calculateRevenue(c);
            yearStats[year].revenue += rev;
            yearStats[year].value += c.value || 0;
            yearStats[year].count += 1;

            // By Unit
            const uId = c.unit_id;
            if (uId && unitMap.has(uId)) {
                const uName = unitMap.get(uId)!;
                if (!yearStats[year].byUnit[uName]) yearStats[year].byUnit[uName] = { revenue: 0, count: 0 };
                yearStats[year].byUnit[uName].revenue += rev;
                yearStats[year].byUnit[uName].count += 1;
            }

            // By Person
            const pId = c.employee_id;
            if (pId && personMap.has(pId)) {
                const pName = personMap.get(pId)!;
                if (!yearStats[year].byPerson[pName]) yearStats[year].byPerson[pName] = { revenue: 0, count: 0 };
                yearStats[year].byPerson[pName].revenue += rev;
                yearStats[year].byPerson[pName].count += 1;
            }
        });

        // ═══════════════════════════════════════════════════════════
        // PHẦN 3 — PHÂN TÍCH THEO QUÝ (năm hiện tại)
        // ═══════════════════════════════════════════════════════════
        const currentYear = new Date().getFullYear();
        const quarterStats: Record<number, { revenue: number; value: number; count: number; byUnit: Record<string, number> }> = {};

        allContracts.forEach((c: any) => {
            const year = getYear(c.signed_date) || getYear(c.start_date);
            const quarter = getQuarter(c.signed_date) || getQuarter(c.start_date);
            if (year !== currentYear || !quarter) return;

            if (!quarterStats[quarter]) quarterStats[quarter] = { revenue: 0, value: 0, count: 0, byUnit: {} };

            const rev = calculateRevenue(c);
            quarterStats[quarter].revenue += rev;
            quarterStats[quarter].value += c.value || 0;
            quarterStats[quarter].count += 1;

            const uId = c.unit_id;
            if (uId && unitMap.has(uId)) {
                const uName = unitMap.get(uId)!;
                quarterStats[quarter].byUnit[uName] = (quarterStats[quarter].byUnit[uName] || 0) + rev;
            }
        });

        // ═══════════════════════════════════════════════════════════
        // PHẦN 4 — PHÂN TÍCH THEO THÁNG (năm hiện tại)
        // ═══════════════════════════════════════════════════════════
        const monthStats: Record<number, { revenue: number; count: number }> = {};
        allContracts.forEach((c: any) => {
            const year = getYear(c.signed_date) || getYear(c.start_date);
            const month = getMonth(c.signed_date) || getMonth(c.start_date);
            if (year !== currentYear || !month) return;

            if (!monthStats[month]) monthStats[month] = { revenue: 0, count: 0 };
            monthStats[month].revenue += calculateRevenue(c);
            monthStats[month].count += 1;
        });

        // ═══════════════════════════════════════════════════════════
        // CONSTRUCT REPORT
        // ═══════════════════════════════════════════════════════════
        const now = new Date();
        let report = `=== BÁO CÁO QUẢN TRỊ THÔNG MINH ===\n`;
        report += `Thời điểm cập nhật: ${now.toLocaleString('vi-VN')}\n`;
        report += `Hôm nay: ${now.getDate()}/${now.getMonth() + 1}/${now.getFullYear()}, Quý ${Math.ceil((now.getMonth() + 1) / 3)}\n\n`;

        // --- Tổng quan ---
        report += `═══ 1. TỔNG QUAN (TẤT CẢ THỜI GIAN) ═══\n`;
        report += `- Tổng doanh thu thực tế: ${formatCurrency(totalRevenue)}\n`;
        report += `- Tổng giá trị ký kết: ${formatCurrency(totalValue)}\n`;
        report += `- Tổng số hợp đồng: ${allContracts.length}\n`;
        report += `- Dòng tiền đã về: ${formatCurrency(paymentsStats.cashReceivedAmount)}\n`;
        report += `- Đã xuất hóa đơn: ${formatCurrency(paymentsStats.invoicedAmount)}\n\n`;

        report += `Top 5 đơn vị (tất cả thời gian):\n`;
        topUnitsAll.forEach((u, idx) => {
            report += `  ${idx + 1}. ${u.name}: ${formatCurrency(u.revenue)} (${u.count} HĐ)\n`;
        });
        report += `\nTop 5 nhân sự (tất cả thời gian):\n`;
        topSalesAll.forEach((p, idx) => {
            report += `  ${idx + 1}. ${p.name}: ${formatCurrency(p.revenue)}\n`;
        });

        // --- Theo năm ---
        const sortedYears = Object.keys(yearStats).map(Number).sort((a, b) => b - a);
        report += `\n═══ 2. DOANH THU THEO NĂM ═══\n`;
        sortedYears.forEach(year => {
            const ys = yearStats[year];
            report += `\n▸ Năm ${year}: ${formatCurrency(ys.revenue)} (${ys.count} HĐ, giá trị ký: ${formatCurrency(ys.value)})\n`;

            // Top đơn vị theo năm
            const unitsSorted = Object.entries(ys.byUnit).sort((a, b) => b[1].revenue - a[1].revenue).slice(0, 5);
            if (unitsSorted.length > 0) {
                report += `  Đơn vị:\n`;
                unitsSorted.forEach(([name, s], i) => {
                    report += `    ${i + 1}. ${name}: ${formatCurrency(s.revenue)} (${s.count} HĐ)\n`;
                });
            }

            // Top nhân sự theo năm
            const peopleSorted = Object.entries(ys.byPerson).sort((a, b) => b[1].revenue - a[1].revenue).slice(0, 3);
            if (peopleSorted.length > 0) {
                report += `  Nhân sự:\n`;
                peopleSorted.forEach(([name, s], i) => {
                    report += `    ${i + 1}. ${name}: ${formatCurrency(s.revenue)} (${s.count} HĐ)\n`;
                });
            }
        });

        // --- Theo quý (năm nay) ---
        const sortedQuarters = Object.keys(quarterStats).map(Number).sort();
        if (sortedQuarters.length > 0) {
            report += `\n═══ 3. DOANH THU THEO QUÝ — NĂM ${currentYear} ═══\n`;
            sortedQuarters.forEach(q => {
                const qs = quarterStats[q];
                report += `\n▸ Quý ${q}/${currentYear}: ${formatCurrency(qs.revenue)} (${qs.count} HĐ)\n`;

                const unitsSorted = Object.entries(qs.byUnit).sort((a, b) => b[1] - a[1]).slice(0, 5);
                unitsSorted.forEach(([name, rev], i) => {
                    report += `    ${i + 1}. ${name}: ${formatCurrency(rev)}\n`;
                });
            });
        }

        // --- Theo tháng (năm nay) ---
        const sortedMonths = Object.keys(monthStats).map(Number).sort();
        if (sortedMonths.length > 0) {
            report += `\n═══ 4. DOANH THU THEO THÁNG — NĂM ${currentYear} ═══\n`;
            sortedMonths.forEach(m => {
                const ms = monthStats[m];
                report += `  Tháng ${m}: ${formatCurrency(ms.revenue)} (${ms.count} HĐ)\n`;
            });
        }

        // --- Hướng dẫn AI ---
        report += `\n═══ 5. HƯỚNG DẪN TRẢ LỜI ═══\n`;
        report += `- QUAN TRỌNG: Khi user hỏi "doanh thu năm X", PHẢI dùng dữ liệu của năm X ở mục 2, KHÔNG dùng tổng tất cả thời gian.\n`;
        report += `- Khi user hỏi "quý X" hoặc "Q1/Q2/Q3/Q4", dùng dữ liệu quý ở mục 3.\n`;
        report += `- Khi user hỏi "tháng X", dùng dữ liệu tháng ở mục 4.\n`;
        report += `- Khi user hỏi "tổng" hoặc "toàn bộ" KHÔNG kèm năm, dùng mục 1.\n`;
        report += `- Nếu user hỏi "doanh thu năm 2026 của đơn vị X", tìm đơn vị X trong mục "Năm 2026 → Đơn vị".\n`;
        report += `- Quy ước: Q1=Tháng 1-3, Q2=Tháng 4-6, Q3=Tháng 7-9, Q4=Tháng 10-12.\n`;
        report += `- Dữ liệu trên LÀ CHÍNH XÁC. Không tự bịa đặt số liệu.\n`;
        report += `- Nếu không có dữ liệu cho khoảng thời gian user hỏi, hãy thông báo rõ.\n`;

        // Lưu cache
        cachedContexts[cacheKey] = { data: report, at: Date.now() };
        return report;

    } catch (error) {
        console.error("Context Advanced Fetch Error", error);
        return "⚠️ (Hệ thống dữ liệu đang cập nhật, vui lòng hỏi lại sau ít phút)";
    }
};
