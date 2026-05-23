# BÁO CÁO HIỆN TRẠNG & ĐỀ XUẤT CHỈNH SỬA
## Hệ thống tính toán tài chính — CIC ERP Contract

> **Ngày báo cáo:** 2026-05-23
> **Phiên bản code:** Main branch (sau fix vòng 1)
> **Người khảo sát:** Claude Code Audit

---

## I. TÓM TẮT EXECUTIVE

### 1.1. Tình trạng tổng thể

Hệ thống đã được refactor **đáng kể** ở vòng 1 và đạt được mức độ nhất quán cao hơn cho hầu hết các chỉ số tài chính. Tuy nhiên, **còn 2 bug nghiêm trọng** liên quan đến cách `expected_revenue` được persist vào DB, dẫn đến **sai lệch dây chuyền** cho 3 chỉ số chính: LNG Quản trị, LNG theo Doanh thu, và Tỷ suất Lợi nhuận.

### 1.2. Kết quả kiểm tra theo chỉ số

| Trạng thái | Số chỉ số | Chi tiết |
|:---:|:---:|---|
| 🟢 **An toàn** | 7/13 | Giá trị ký, Chi phí dự kiến, Tạm ứng, Tiền về, Công nợ phải thu, Công nợ phải trả, Lợi nhuận gộp |
| 🟡 **Cảnh báo nhẹ** | 3/13 | Doanh thu thực tế, Số tiền xuất HĐ, Tỷ suất LN |
| 🔴 **Nghiêm trọng** | 3/13 | **Doanh thu dự kiến**, **LNG Quản trị**, **LNG theo DT** |

### 1.3. Ưu tiên hành động

| Mức ưu tiên | Số lượng bug | Ước tính effort |
|:---:|:---:|:---:|
| 🚨 URGENT | 2 bug | 1-2 giờ code + 30 phút chạy script |
| ⚠️ HIGH | 2 bug | 2-3 giờ |
| 📋 LOW | 3 bug | 1 giờ cleanup |

---

## II. HIỆN TRẠNG CHI TIẾT

### 2.1. Kiến trúc tính toán hiện tại

```
┌──────────────────────────────────────────────────────────────────┐
│                     DATABASE (Single Source of Truth)            │
│                                                                  │
│  contracts table — pre-computed columns:                         │
│    value, expected_revenue, estimated_cost,                      │
│    actual_revenue, admin_profit, rev_profit, cash_received       │
│                                                                  │
│  Trigger 1: update_contract_financials (AFTER payments change)   │
│    → Tính: invoiced_amount, cash_received, actual_cost,          │
│             actual_revenue, receivables                          │
│                                                                  │
│  Trigger 2: calculate_contract_profits (BEFORE contracts change) │
│    → Tính: expected_revenue, admin_profit, rev_profit            │
└──────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌──────────────────────────────────────────────────────────────────┐
│                       SERVICE LAYER                              │
│                                                                  │
│  contractFinancials.ts:                                          │
│    + calculateRevenueFromPayments()  ← pure                      │
│    + calculateCashReceived()         ← pure                      │
│    + calculateExpectedRevenue()      ← pure (từ lineItems)       │
│    + calculatePeriodFinancials()     ← NEW (helper chung) ✅     │
│                                                                  │
│  contractMapper.ts → mapContract():                              │
│    Single source of truth khi đọc 1 HĐ → trả về:                 │
│    expectedRevenue, adminProfit, revProfit, margin, ...          │
│                                                                  │
│  contractUtils.ts → buildPayload():                              │
│    Single source of truth khi ghi 1 HĐ                           │
│    ⚠️ THIẾU: expected_revenue mapping                            │
└──────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌──────────────────────────────────────────────────────────────────┐
│                         VIEW LAYER                               │
│                                                                  │
│  Dashboard.tsx           → getStatsFallback (period-filtered)    │
│  ContractList.tsx        → getStats (signed_date-filtered)       │
│  ContractListTableRow    → đọc contract.* (đã mapped)            │
│  ContractDetail.tsx      → đọc contract.* + useFinancialCalc     │
│  ContractForm.tsx        → useFinancialCalculations (realtime)   │
└──────────────────────────────────────────────────────────────────┘
```

### 2.2. Những gì đã làm TỐT ✅

#### A. Single Source of Truth được thiết lập đúng cho phần đọc

- **`mapContract`** trở thành nguồn duy nhất chuyển DB row → Contract object
- Tất cả các chỉ số (cashReceived, advanceAmount, receivables, payables, adminProfit, revProfit, **expectedRevenue**, **margin**) đều được tính/đọc 1 lần tại đây
- View chỉ cần đọc `contract.X` — không tính lại

#### B. Helper chung `calculatePeriodFinancials` cho aggregation theo kỳ

```typescript
// services/contract/contractFinancials.ts:197-259
export const calculatePeriodFinancials = (contract, isInPeriod) => ({
    revenueInPeriod,    // DT thực tế các payment có invoice_date ∈ kỳ
    cashInPeriod,       // Tiền về các RECEIPT có payment_date ∈ kỳ
    revProfitInPeriod   // LNG DT theo period
})
```

Dùng chung ở:
- `getStatsFallback()` (Dashboard)
- `getChartDataFallback()` (biểu đồ tháng)
- `unitService.getWithStats()` (bảng đơn vị)

→ Không còn copy-paste 3 bản, giảm risk lệch logic.

#### C. View không tính toán phụ thuộc lineItems nữa

- `ContractListTableRow` đã chuyển từ `Σ(outputPrice × qty)` sang đọc `contract.expectedRevenue`
- Khi update logic tính expectedRevenue → chỉ sửa 1 chỗ (mapContract)

### 2.3. Vấn đề còn tồn tại 🔴

Xem chi tiết ở **Phần III. DANH SÁCH BUG** bên dưới.

---

## III. DANH SÁCH BUG CHI TIẾT

### 🚨 BUG #1 — `buildPayload` thiếu `expected_revenue` (URGENT)

**Mức độ:** 🔴 NGHIÊM TRỌNG — Sai lệch dây chuyền 3 chỉ số chính

**File:** `services/contract/contractUtils.ts:107-148`

**Mô tả:**

`buildPayload()` là nơi map Frontend Contract → DB payload trước khi insert/update. Hiện tại `fieldMap` KHÔNG có entry cho `expectedRevenue`, dẫn đến giá trị này KHÔNG BAO GIỜ được gửi từ Frontend lên DB.

```typescript
const fieldMap: Record<string, string> = {
    // ...
    value: 'value',
    estimatedCost: 'estimated_cost',
    actualRevenue: 'actual_revenue',
    // ❌ THIẾU: expectedRevenue: 'expected_revenue',
    // ...
};
```

**Cơ chế gây bug:**

Trigger DB `calculate_contract_profits` được thiết kế:
```sql
IF NEW.expected_revenue IS NOT NULL AND NEW.expected_revenue > 0 THEN
    v_expected_revenue := NEW.expected_revenue;  -- ưu tiên giá trị Frontend gửi
ELSIF có VAT THEN
    v_expected_revenue := value / (1 + vat_rate / 100);  -- fallback
```

→ Frontend KHÔNG gửi → trigger đọc giá trị CŨ trong DB → giữ nguyên → không tính lại.

**Kịch bản bug minh hoạ:**

```
Bước 1: User tạo HĐ
  value = 110.000.000, vat_rate = 10%
  Trigger tính: expected_revenue = 100.000.000 ✅
  DB lưu: value=110tr, expected_revenue=100tr, admin_profit, rev_profit ĐÚNG

Bước 2: User cập nhật giá trị
  Update value = 220.000.000 (gấp đôi)
  Frontend gửi: { value: 220.000.000 }  ❌ KHÔNG có expected_revenue
  
  Trigger chạy:
    NEW.expected_revenue = 100tr (giá trị cũ từ DB, vì Frontend không gửi)
    → IF 100tr > 0 → giữ nguyên 100tr ❌
    → admin_profit = 100tr - estimated_cost (SAI vì lẽ ra phải là 200tr - cost)
    → rev_profit theo tỷ lệ SAI
  
  DB sau update:
    value = 220.000.000  ✅
    expected_revenue = 100.000.000  ❌ (đáng lẽ phải là 200.000.000)
    admin_profit       = SAI
    rev_profit         = SAI
```

**Tần suất gặp bug:**

- Bất kỳ HĐ nào được **update value** sau khi đã có expected_revenue trong DB
- Bất kỳ HĐ nào được **update lineItems** (vatRate hỗn hợp) mà giữ nguyên value
- → Ước tính: **>50% HĐ đang lưu sai** số liệu profit nếu đã từng được edit

**Tác động dây chuyền:**

```
expected_revenue SAI
  ↓
admin_profit = expected_revenue - estimated_cost  → SAI
  ↓
rev_profit = (actual_revenue / expected_revenue) × admin_profit  → SAI ×2
  ↓
contract.margin = adminProfit / expectedRevenue × 100  → SAI
  ↓
Hiển thị SAI ở: Dashboard, ContractList, ContractDetail, Báo cáo PDF
```

**Đề xuất sửa:**

```typescript
// services/contract/contractUtils.ts
const fieldMap: Record<string, string> = {
    // ... các field cũ ...
    value: 'value',
    estimatedCost: 'estimated_cost',
    expectedRevenue: 'expected_revenue',   // ← THÊM DÒNG NÀY
    actualRevenue: 'actual_revenue',
    // ... các field còn lại ...
};
```

Đồng thời, trong block tính `details JSONB` (~line 170-185), bổ sung tính `expected_revenue` từ lineItems:

```typescript
if (data.lineItems !== undefined || data.executionCosts !== undefined) {
    const execSum = ((data.executionCosts as ExecutionCostItem[]) || []).reduce(
        (sum, c) => sum + (c.amount || 0), 0
    );
    const inputSum = ((data.lineItems as any[]) || []).reduce(
        (sum: number, li: any) => {
            const directVal = (li.directCosts as number) || 0;
            const effectiveDirectCosts = directVal > 0
                ? directVal
                : ((li.directCostDetails as any[]) || []).reduce((s: number, d: any) => s + (d.amount || 0), 0);
            return sum + ((li.inputPrice as number) || 0) * ((li.quantity as number) || 1) + effectiveDirectCosts;
        },
        0
    );
    payload.estimated_cost = inputSum + execSum;
    
    // ★ THÊM: Tính expected_revenue từ lineItems (chính xác cho VAT mix)
    const expectedRevenue = ((data.lineItems as any[]) || []).reduce(
        (sum: number, li: any) => sum + ((li.outputPrice as number) || 0) * ((li.quantity as number) || 1),
        0
    );
    if (expectedRevenue > 0) {
        payload.expected_revenue = expectedRevenue;
    }
}
```

**Migration data:** Sau khi fix code, cần chạy `scripts/recalculate-financials.ts` để fix data cũ.

---

### 🚨 BUG #2 — Trigger DB không hỗ trợ VAT mix (URGENT)

**Mức độ:** 🔴 NGHIÊM TRỌNG (nhưng tự khắc phục sau khi fix Bug #1)

**File:** `supabase/migrations/20260522111000_add_expected_revenue_column.sql:14-15`

**Mô tả:**

Trigger DB fallback tính `expected_revenue` bằng công thức VAT đồng nhất:
```sql
v_expected_revenue := COALESCE(NEW.value, 0) / (1 + COALESCE(NEW.vat_rate, 10)::NUMERIC / 100);
```

Trong khi Frontend tính `signingValue` với VAT per-item:
```typescript
// useFinancialCalculations.ts:43
signingValue += outputTotal * (1 + itemVatRate / 100);  // VAT per item
```

→ **Khác biệt** khi HĐ có lineItems với vatRate khác nhau (VD: item1 10%, item2 0%, item3 8%).

**Ví dụ số:**
```
Item 1: outputPrice = 100tr, qty = 1, vatRate = 10% → signing = 110tr, expected = 100tr
Item 2: outputPrice = 50tr,  qty = 1, vatRate = 0%  → signing = 50tr,  expected = 50tr
Item 3: outputPrice = 30tr,  qty = 1, vatRate = 8%  → signing = 32.4tr, expected = 30tr

Tổng: value = 192.4tr, expected_revenue thật = 180tr
Vat_rate của HĐ = 10% (giá trị mặc định ở HĐ level)

Trigger DB tính (nếu Bug #1 chưa được fix):
  expected_revenue = 192.4tr / 1.1 = 174.9tr ❌ (đáng lẽ là 180tr — chênh 5tr)
```

**Đề xuất sửa:**

Sau khi fix Bug #1, Frontend sẽ gửi `expected_revenue` đúng → trigger sẽ giữ nguyên giá trị Frontend. Trigger fallback chỉ là backup cho legacy data → có thể giữ nguyên, hoặc cải tiến thêm:

**Option A (khuyến nghị):** Giữ trigger như cũ, chỉ cần Bug #1 được fix.

**Option B (cleanup tận gốc):** Sửa trigger để parse JSONB `details.lineItems` và tính chính xác:
```sql
-- Phức tạp hơn, nhưng đảm bảo trigger độc lập với Frontend
SELECT COALESCE(SUM((item->>'outputPrice')::numeric * (item->>'quantity')::numeric), 0)
INTO v_expected_revenue
FROM jsonb_array_elements(NEW.details->'lineItems') AS item;
```

→ Khuyến nghị Option A vì đơn giản hơn.

---

### ⚠️ BUG #3 — Trigger payment không filter status (HIGH)

**Mức độ:** 🟡 TRUNG BÌNH

**File:** `supabase/migrations/20260310060000_fix_payment_trigger.sql:33-75`

**Mô tả:**

Trigger `update_contract_financials` (chạy sau khi payments thay đổi) tính `invoiced_amount` và `actual_revenue` **KHÔNG filter theo status**:

```sql
-- ❌ Hiện tại — không filter status
SELECT COALESCE(SUM(amount), 0)
INTO v_invoiced_amount
FROM payments
WHERE contract_id = target_contract_id
AND voucher_type = 'VAT_INVOICE';
```

Trong khi `contractMapper` lại có filter:
```typescript
// contractFinancials.ts:90-96
.filter((p: any) => p.voucher_type === 'VAT_INVOICE' &&
    ['Đã xuất HĐ', 'Đã giao KH', 'Tiền về', 'Paid'].includes(p.status))
```

→ Nếu DB có payment status "Draft", "Mới", null → 2 nguồn ra số khác nhau.

**Tác động:**
- TypeScript `PaymentStatus` chỉ cho 6 status → runtime thường OK
- Nhưng: legacy data, import từ Excel, RPC raw call → có thể tạo payment với status khác
- Lúc đó: ContractDetail (mapContract) và Dashboard (đọc DB cột) hiển thị KHÁC NHAU cho cùng 1 HĐ

**Đề xuất sửa:**

```sql
-- ✅ Đề xuất — thêm filter status
-- 1. Invoiced Amount
SELECT COALESCE(SUM(amount), 0)
INTO v_invoiced_amount
FROM payments
WHERE contract_id = target_contract_id
AND voucher_type = 'VAT_INVOICE'
AND status IN ('Đã xuất HĐ', 'Đã giao KH', 'Tiền về', 'Paid');  -- ← THÊM

-- 4. Actual Revenue
SELECT COALESCE(SUM(
    CASE
        WHEN vat_invoice_items IS NOT NULL AND jsonb_array_length(vat_invoice_items) > 0 THEN
            (SELECT COALESCE(SUM((item->>'amountBeforeVAT')::numeric), 0)
             FROM jsonb_array_elements(vat_invoice_items) AS item)
        WHEN v_contract_has_vat AND v_contract_vat_rate > 0 THEN
            amount / (1 + v_contract_vat_rate / 100)
        ELSE
            amount
    END
), 0)
INTO v_actual_revenue
FROM payments
WHERE contract_id = target_contract_id
AND voucher_type = 'VAT_INVOICE'
AND status IN ('Đã xuất HĐ', 'Đã giao KH', 'Tiền về', 'Paid');  -- ← THÊM
```

---

### ⚠️ BUG #4 — Dashboard vs ContractList logic period filter không khớp (HIGH)

**Mức độ:** 🟡 TRUNG BÌNH — Sai về semantics nghiệp vụ

**Files:**
- `services/contractService.ts:490-715` — `getStats()` (dùng cho ContractList)
- `services/contractService.ts:747-878` — `getStatsFallback()` (dùng cho Dashboard)

**Mô tả:**

2 hàm này cùng trả về `totalRevenue, totalCash, totalProfit, ...` nhưng dùng logic period filter KHÁC NHAU:

| | `getStats` (ContractList) | `getStatsFallback` (Dashboard) |
|---|---|---|
| Filter HĐ | `signed_date BETWEEN [kỳ]` (SQL) | Không filter — lọc trong JS |
| `totalValue` | Σ value của HĐ ký trong kỳ | Σ value (chỉ HĐ có signed_date ∈ kỳ) |
| `totalRevenue` | Σ **actual_revenue TỔNG** của HĐ (không lọc kỳ payment) | Σ doanh thu các payment có **invoice_date ∈ kỳ** |
| `totalCash` | Σ **cash_received TỔNG** của HĐ | Σ amount RECEIPT có **payment_date ∈ kỳ** |
| `totalProfit` | Σ admin_profit TỔNG | Σ admin_profit (HĐ ký trong kỳ) |
| `totalRevenueProfit` | Σ **rev_profit TỔNG** từ DB | Tính lại: revenueInPeriod × profitRatio |

**Ví dụ minh hoạ:**

```
HĐ A: ký 2024-12, value 100tr
  - Doanh thu phát sinh 2025-03 (xuất HĐ VAT): 50tr
  - Tiền về 2025-04: 60tr

User filter kỳ "2025":

ContractList getStats():
  - signed_date 2024-12 ∉ 2025 → HĐ A KHÔNG xuất hiện
  - totalRevenue = 0 (không cộng 50tr)
  - totalCash = 0 (không cộng 60tr)

Dashboard getStatsFallback():
  - signed_date 2024-12 ∉ 2025 → totalValue không cộng 100tr ✅
  - invoice_date 2025-03 ∈ 2025 → totalRevenue += 50tr ✅
  - payment_date 2025-04 ∈ 2025 → totalCash += 60tr ✅
```

→ **Dashboard hiểu đúng nghiệp vụ "Doanh thu phát sinh trong kỳ"**, ContractList hiểu sai.

**Đề xuất sửa:**

**Option A (khuyến nghị):** Làm `getStats` dùng logic giống `getStatsFallback`:
- Bỏ SQL filter theo `signed_date` (để cho JS lọc)
- JOIN `payments` để tính revenue/cash theo period
- Dùng helper `calculatePeriodFinancials`

```typescript
// services/contractService.ts:550
let query = supabase.from('contracts').select(
    'id, value, expected_revenue, actual_revenue, admin_profit, ' +
    'estimated_cost, vat_rate, has_vat, ' +  // ← THÊM cho fallback
    'status, title, contract_code, party_a, signed_date, ' +
    'unit_id, unit_allocations, employee_id, employee_allocations, ' +
    'payments(amount, status, voucher_type, payment_date, invoice_date, vat_invoice_items)'  // ← THÊM
);
// Bỏ SQL filter theo signed_date
// ...
// Trong reduce, dùng calculatePeriodFinancials giống getStatsFallback
```

**Trade-off:** ContractList sẽ chậm hơn (do JOIN payments), nhưng số liệu đúng. Cân nhắc thêm pagination + cache.

**Option B:** Đổi tên field để semantics rõ ràng:
- `getStats` → trả về `totalRevenueOfContractsSignedInPeriod`
- `getStatsFallback` → trả về `totalRevenueInPeriod`

Frontend hiển thị 2 con số kèm tooltip giải thích. Không đụng business logic, dễ implement nhưng người dùng vẫn confused.

→ **Khuyến nghị Option A**.

---

### 📋 BUG #5 — `ContractListTableRow` tính lại margin dư thừa (LOW)

**Mức độ:** 🟢 NHẸ — Không gây sai, chỉ là code dư thừa

**File:** `components/ContractListTableRow.tsx:124, 449`

**Mô tả:**

```typescript
const adminProfit = Math.round((contract.adminProfit || 0) * allocFraction);
const expectedRevenue = Math.round((contract.expectedRevenue || 0) * allocFraction);
const margin = expectedRevenue > 0 ? (adminProfit / expectedRevenue) * 100 : contract.margin || 0;
```

Toán học: `(adminProfit × frac) / (expectedRevenue × frac) × 100 = adminProfit / expectedRevenue × 100`
→ allocFraction triệt tiêu → kết quả = `contract.margin` (đã tính sẵn ở mapContract).

→ Kết quả đúng, nhưng:
- Dư thừa 2 phép nhân + 1 phép chia
- Nếu mai sau ai đó đổi công thức margin trong mapContract mà quên file này → lệch logic

**Đề xuất sửa:**

```typescript
// ✅ Đơn giản, đúng
const margin = contract.margin || 0;
```

---

### 📋 BUG #6 — Dead code: biến `expectedRevenue` không dùng (LOW)

**Mức độ:** 🟢 NHẸ

**Files:**
- `services/contractService.ts:843-845` (getStatsFallback)
- `services/contractService.ts:1099-1101` (getChartDataFallback)
- `services/unitService.ts:260-262` (getWithStats)

**Mô tả:**

3 nơi đều có đoạn:
```typescript
const expectedRevenue = curr.expected_revenue !== null && curr.expected_revenue !== undefined
    ? Number(curr.expected_revenue)
    : (hasVat && vatRate > 0 ? Math.round(val / (1 + vatRate / 100)) : val);
const expectedProfit = curr.admin_profit !== null && curr.admin_profit !== undefined
    ? Number(curr.admin_profit)
    : expectedRevenue - estimatedCost;
```

Biến `expectedRevenue` **không được dùng** ở scope tiếp theo (helper `calculatePeriodFinancials` tự tính lại). Chỉ `expectedProfit` được dùng cho `totalProfit/totalSigningProfit`.

**Đề xuất sửa:**

```typescript
// Gộp 2 dòng thành 1, không cần biến trung gian
const expectedProfit = curr.admin_profit !== null && curr.admin_profit !== undefined
    ? Number(curr.admin_profit)
    : ((curr.expected_revenue ?? (hasVat && vatRate > 0 ? Math.round(val / (1 + vatRate / 100)) : val)) - estimatedCost);
```

---

### 📋 BUG #7 — Helper fallback không đồng nhất với mapContract (LOW)

**Mức độ:** 🟢 NHẸ — Ít ảnh hưởng thực tế

**File:** `services/contract/contractFinancials.ts:212-214`

**Mô tả:**

Helper `calculatePeriodFinancials` fallback dùng VAT đồng nhất:
```typescript
const expectedRevenue = contract.expected_revenue !== null && contract.expected_revenue !== undefined
    ? Number(contract.expected_revenue)
    : (hasVat && vatRate > 0 ? Math.round(val / (1 + vatRate / 100)) : val);
```

Trong khi `mapContract` fallback ưu tiên lineItems:
```typescript
const fallbackExpectedRevenue = calculateExpectedRevenue(lineItems) || (
    c.has_vat !== false && (c.vat_rate ?? 10) > 0
        ? Math.round((c.value || 0) / (1 + (c.vat_rate ?? 10) / 100))
        : (c.value || 0)
);
```

→ Trường hợp DB `expected_revenue` null/undefined: 2 fallback ra số khác.

**Lý do thực tế:**

Helper được dùng cho aggregation queries không SELECT JSONB `details` (vì performance) → không có lineItems → đành dùng fallback đơn giản.

**Đề xuất sửa:**

**Option A (khuyến nghị — đơn giản):** Sau khi Bug #1 được fix, DB sẽ luôn có giá trị → fallback hiếm khi chạy → chấp nhận sự khác biệt.

**Option B (cleanup tận gốc):** Thêm `details` vào SELECT queries của helper users:
```typescript
// Trong getStatsFallback, getChartDataFallback, unitService
let query = supabase.from('contracts').select(
    '..., details'  // ← thêm để helper có thể dùng lineItems
);
```

Trade-off: tăng payload size khi query.

→ **Khuyến nghị Option A**, không action ngay.

---

## IV. ROADMAP CHỈNH SỬA ĐỀ XUẤT

### Giai đoạn 1: URGENT FIX (1-2 giờ)

```
□ 1.1. Sửa buildPayload — thêm expected_revenue
       File: services/contract/contractUtils.ts
       
□ 1.2. Chạy script recalculate data cũ
       Command: npx tsx scripts/recalculate-financials.ts
       Verify: SELECT id, value, expected_revenue, admin_profit FROM contracts 
               ORDER BY updated_at DESC LIMIT 10;
       
□ 1.3. Test end-to-end:
       - Tạo HĐ mới với VAT mix → verify expected_revenue đúng
       - Update value của HĐ cũ → verify expected_revenue tính lại
       - Update lineItems → verify expected_revenue đúng
```

### Giai đoạn 2: HIGH FIX (2-3 giờ)

```
□ 2.1. Sửa trigger payment thêm filter status
       File: supabase/migrations/20260524000000_filter_payment_status_in_trigger.sql (NEW)
       Action: CREATE OR REPLACE FUNCTION update_contract_financials với filter status
       
□ 2.2. Hợp nhất logic period filter giữa getStats và getStatsFallback
       File: services/contractService.ts
       Action: Sửa getStats() để dùng calculatePeriodFinancials helper
       Lưu ý: Test kỹ vì sẽ ảnh hưởng số liệu metrics bar của ContractList
```

### Giai đoạn 3: LOW CLEANUP (1 giờ)

```
□ 3.1. Đơn giản hoá margin trong ContractListTableRow
       Sửa 2 dòng: 124, 449
       
□ 3.2. Xoá dead code biến expectedRevenue ở 3 service
       Files: contractService.ts (2 chỗ), unitService.ts (1 chỗ)
       
□ 3.3. (Optional) Cải thiện helper fallback dùng lineItems
       File: contractFinancials.ts
```

### Giai đoạn 4: VERIFICATION (30 phút)

```
□ 4.1. Tạo test data:
       - HĐ 1: VAT đồng nhất 10% → so sánh Dashboard, ContractList, ContractDetail
       - HĐ 2: VAT mix (10%, 8%, 0%) → cùng so sánh
       - HĐ 3: Edit value rồi check expected_revenue
       - HĐ 4: Có payment xuất HĐ tháng khác signed_date → filter theo kỳ
       
□ 4.2. Verify 3 view show CÙNG số:
       - Dashboard "Doanh thu" trong kỳ X
       - ContractList "DT" tổng các dòng
       - Σ ContractDetail.actualRevenue × allocFraction
       
□ 4.3. Update scratch/FINANCIAL_LOGIC_REPORT.md
       Mark các bug đã fix
```

---

## V. KIỂM TRA TIẾP THEO (POST-FIX)

Sau khi áp dụng hết các fix trên, cần audit thêm các vùng SAU đây mà báo cáo này chưa cover:

### 5.1. Các service phụ thuộc Contract metrics

- [ ] `services/employeeService.ts` — tính KPI nhân viên (dùng `actual_revenue, cash_received` từ DB)
- [ ] `services/contextService.ts` — context cho AI tools (dùng `actual_revenue`)
- [ ] `services/contractExportService.ts` — export Excel/PDF
- [ ] `services/projectExportService.ts` — export project
- [ ] `utils/dashboardExport.ts` — export dashboard PDF
- [ ] `utils/businessPlanPdf.ts` — export PAKĐ PDF

→ Cần kiểm tra: các file này có TÍNH LẠI metric thay vì đọc từ Contract object không?

### 5.2. Performance & Customer/Product stats

- [ ] `components/Analytics.tsx` — line 550 đang phân bổ profit theo tỷ lệ value
- [ ] Customer/Brand/Product stats RPCs (`vw_products_with_stats`, `customers_with_stats`...)
- [ ] HRM Payroll service tính lương theo % HĐ

### 5.3. AI Tools (`services/ai/openclaw/tools/`)

- [ ] `contract.tools.ts`, `dashboard.tools.ts`, `finance.tools.ts` — kiểm tra trả về số liệu nào
- [ ] AI có thể đưa ra báo cáo SAI nếu dùng data từ vùng sai

---

## VI. KẾT LUẬN

### Đánh giá tổng quan

Hệ thống đã được refactor đúng hướng. **Vòng fix 1 thành công**: 4/5 vấn đề lớn của vòng audit trước đã được giải quyết. Phần view layer giờ đây hoạt động đúng nguyên tắc "đọc giá trị đã tính sẵn, không tính lại".

### Vấn đề còn lại

**Hai bug nghiêm trọng (#1, #2)** đều liên quan đến CÙNG một gốc rễ: `expected_revenue` không được Frontend gửi lên DB, dẫn đến trigger DB không tính lại được khi `value` hoặc `lineItems` thay đổi. **Fix Bug #1 sẽ kéo theo giải quyết Bug #2**.

Hai bug trung bình (#3, #4) ảnh hưởng đến consistency giữa các view nhưng ít gây sai về mặt số tuyệt đối (vì các status không hợp lệ hiếm gặp, và Dashboard/ContractList tuy khác semantics nhưng cả 2 đều "có lý" nghiệp vụ riêng).

### Khuyến nghị cuối

1. **Ưu tiên fix Bug #1 ngay** — đây là gốc rễ của hầu hết sai số profit
2. Chạy `scripts/recalculate-financials.ts` để sửa data cũ
3. Sau đó fix Bug #3, #4 trong sprint kế tiếp
4. Cleanup #5, #6, #7 có thể gộp vào 1 PR riêng

---

*Báo cáo được tạo bởi Claude Code — khảo sát trực tiếp từ source code.*
*Phiên bản: 2026-05-23*

---

## VII. NHẬT KÝ FIX (2026-05-23)

> Phần này ghi lại các thay đổi đã apply trên codebase sau khi báo cáo được phê duyệt.

### Bug #1: ✅ FIXED — `buildPayload` đã có `expected_revenue`

**File:** `services/contract/contractUtils.ts`

**Thay đổi:**
1. Thêm `expectedRevenue: 'expected_revenue'` vào `fieldMap` (line 126)
2. Trong block JSONB details, tự tính `expected_revenue` từ lineItems khi user save HĐ:
   ```typescript
   const expectedRevenueFromLineItems = ((data.lineItems as any[]) || []).reduce(
       (sum: number, li: any) => sum + ((li.outputPrice as number) || 0) * ((li.quantity as number) || 1),
       0
   );
   if (expectedRevenueFromLineItems > 0) {
       payload.expected_revenue = Math.round(expectedRevenueFromLineItems);
   }
   ```

**Tác động:** Mỗi lần create/update HĐ, Frontend gửi giá trị chính xác lên DB → trigger sẽ giữ nguyên giá trị này → admin_profit, rev_profit được tính lại đúng.

**Hành động tiếp theo:** Chạy `npx tsx scripts/recalculate-financials.ts` để fix data cũ.

---

### Bug #2: ✅ AUTO-FIXED (kế thừa từ Bug #1)

Sau khi Bug #1 được fix, Frontend luôn gửi `expected_revenue` đúng cho HĐ có VAT mix. Trigger DB chỉ còn vai trò fallback cho legacy data → giữ nguyên không sửa.

---

### Bug #3: ✅ FIXED — Trigger payment đã filter status

**File mới:** `supabase/migrations/20260523000000_filter_payment_status_in_trigger.sql`

**Thay đổi:**
- `CREATE OR REPLACE FUNCTION update_contract_financials()`:
  - Tính `v_invoiced_amount` với filter: `status IN ('Đã xuất HĐ', 'Đã giao KH', 'Tiền về', 'Paid')`
  - Tính `v_actual_revenue` với cùng filter
- Backfill: chạy 3 UPDATE statements để recalculate `invoiced_amount`, `actual_revenue`, `receivables` cho tất cả HĐ hiện tại

**Tác động:** mapContract và DB cột giờ đây ĐỒNG NHẤT về filter status → không còn risk cùng HĐ ra 2 số khác nhau.

**Hành động tiếp theo:** Apply migration lên Supabase production.

---

### Bug #4: ✅ FIXED — `getStats` và `getStatsFallback` cùng logic

**File:** `services/contractService.ts:550-715`

**Thay đổi:**
1. **Query**: Bỏ SQL filter `signed_date BETWEEN` (lấy ALL contracts), JOIN payments
2. **Aggregation logic**: Tách rõ 2 nhóm metrics:
   - **Signing-based** (chỉ tính HĐ có `signed_date ∈ kỳ`): `totalValue`, `totalContracts`, `totalProfit`, `totalSigningProfit`, `maxContract`, `minContract`, `unitBreakdown`
   - **Payment-based** (theo `invoice_date/payment_date ∈ kỳ`): `totalRevenue`, `totalCash`, `totalRevenueProfit`
3. **Helper:** Dùng `calculatePeriodFinancials(curr, isInPeriod)` thay vì đọc tổng từ DB

**Tác động:**
- HĐ ký 2024-12 có doanh thu xuất HĐ tháng 2025-03: filter "kỳ 2025" → ContractList ĐÚNG ghi nhận 50tr doanh thu (trước đây bỏ sót)
- Dashboard và ContractList giờ đây hiển thị CÙNG con số khi filter cùng kỳ

**Trade-off:** ContractList load chậm hơn do JOIN payments. Có thể cân nhắc cache nếu cần.

---

### Bug #5: ✅ FIXED — `ContractListTableRow.margin` đơn giản hoá

**File:** `components/ContractListTableRow.tsx:122-123, 447-448`

**Thay đổi:**
```typescript
// ❌ Trước:
const expectedRevenue = Math.round((contract.expectedRevenue || 0) * allocFraction);
const margin = expectedRevenue > 0 ? (adminProfit / expectedRevenue) * 100 : contract.margin || 0;

// ✅ Sau:
const margin = contract.margin || 0;
```

**Tác động:** Bớt 1 phép nhân + 1 phép chia/row. Logic margin tập trung 100% ở mapContract.

---

### Bug #6: ✅ FIXED — Xoá dead code `expectedRevenue` ở 3 service

**Files:**
- `services/contractService.ts:840-846` (getStatsFallback)
- `services/contractService.ts:1097-1101` (getChartDataFallback)
- `services/unitService.ts:260-263` (getWithStats)

**Thay đổi:** Gộp 2 dòng (`expectedRevenue` + `expectedProfit`) thành 1 dòng `expectedProfit`, loại bỏ biến không sử dụng.

---

### Bug #7: ⏸ KHÔNG ACTION

Sau khi Bug #1 được fix, DB sẽ luôn có giá trị `expected_revenue` đúng → fallback của helper hiếm khi chạy → chấp nhận.

---

### TỔNG KẾT

| Bug | Status | Files thay đổi | Cần action thủ công? |
|:---:|:------:|---------------|:--------------------:|
| #1 | ✅ FIXED | `contractUtils.ts` | Chạy script recalculate |
| #2 | ✅ AUTO | (kế thừa #1) | - |
| #3 | ✅ FIXED | New migration | Apply migration |
| #4 | ✅ FIXED | `contractService.ts` | Test kỹ ContractList |
| #5 | ✅ FIXED | `ContractListTableRow.tsx` | - |
| #6 | ✅ FIXED | 2 files (3 vị trí) | - |
| #7 | ⏸ SKIP | - | - |

### Verification

- TypeScript check: ✅ Không có lỗi trên các file thay đổi (`tsc --noEmit -p tsconfig.json` filter qua tên file → 0 lỗi)
- Build error tổng: lỗi pre-existing không liên quan (modules `vite-plugin-pwa`, `file-saver`, `exceljs`, `@tiptap/*` thiếu)

### Hành động tiếp theo (manual)

1. **Apply migration trên Supabase:**
   ```bash
   supabase db push
   # Hoặc apply trực tiếp file 20260523000000_filter_payment_status_in_trigger.sql
   ```

2. **Recalculate data cũ:**
   ```bash
   npx tsx scripts/recalculate-financials.ts
   ```

3. **Verify dataset:**
   ```sql
   -- Kiểm tra 10 HĐ gần nhất xem expected_revenue có sync với value không
   SELECT id, value, vat_rate, expected_revenue,
          ROUND(value / (1 + vat_rate/100.0)) AS expected_calc,
          admin_profit, rev_profit
   FROM contracts
   WHERE updated_at > NOW() - INTERVAL '7 days'
   ORDER BY updated_at DESC
   LIMIT 10;
   ```

4. **Test UI:**
   - Tạo HĐ mới có VAT mix (item 10%, item 0%) → verify expected_revenue đúng
   - Update value HĐ cũ → verify expected_revenue tính lại
   - So sánh Dashboard "Doanh thu" và ContractList "DT" filter cùng kỳ → phải khớp
