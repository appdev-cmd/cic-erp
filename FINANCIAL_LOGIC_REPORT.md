# BÁO CÁO KHẢO SÁT LOGIC TÀI CHÍNH — CIC ERP CONTRACT

> Ngày khảo sát: 2026-05-22
> Phiên bản: Sau commit `8869c12` (main)

---

## MỤC LỤC

1. [Tổng quan kiến trúc](#1-tổng-quan-kiến-trúc)
2. [Các chỉ số tài chính cốt lõi](#2-các-chỉ-số-tài-chính-cốt-lõi)
3. [Luồng dữ liệu: từ nhập liệu → hiển thị](#3-luồng-dữ-liệu)
4. [Chi tiết từng chỉ số & công thức](#4-chi-tiết-từng-chỉ-số)
5. [Hệ thống phân bổ đa đơn vị (Allocation)](#5-hệ-thống-phân-bổ)
6. [Trigger & RPC ở tầng Database](#6-trigger-database)
7. [Bảng tổng hợp: Chỉ số → View hiển thị](#7-bảng-tổng-hợp)
8. [Cảnh báo tự động (Warning Flags)](#8-cảnh-báo-tự-động)
9. [Chỉ tiêu ĐHCĐ (Company Target / KPI Plan)](#9-chỉ-tiêu-đhcđ)

---

## 1. TỔNG QUAN KIẾN TRÚC

```
┌─────────────────────────────────────────────────────────────────┐
│                        DATABASE (Supabase)                      │
│                                                                 │
│  contracts table                                                │
│  ├── value (Giá trị ký kết — bao gồm VAT)                     │
│  ├── expected_revenue (Doanh thu dự kiến trước thuế)           │
│  ├── estimated_cost (Chi phí dự kiến — tính từ lineItems)      │
│  ├── actual_revenue (Doanh thu thực tế — tính từ payments)     │
│  ├── admin_profit (LNG Quản trị)                               │
│  ├── rev_profit (LNG theo Doanh thu)                           │
│  ├── cash_received (Tiền về — cache)                           │
│  ├── details JSONB { lineItems[], executionCosts[] }           │
│  ├── unit_allocations JSONB { allocations[] }                  │
│  └── employee_allocations JSONB                                │
│                                                                 │
│  payments table                                                 │
│  ├── voucher_type: VAT_INVOICE | RECEIPT | EXPENSE             │
│  ├── status: 'Đã xuất HĐ' | 'Đã giao KH' | 'Tiền về' | ...  │
│  ├── amount, vat_invoice_items[]                               │
│  └── invoice_date, payment_date                                │
│                                                                 │
│  TRIGGER: calculate_contract_profits()                          │
│  → Auto-tính: expected_revenue, admin_profit, rev_profit       │
│  → Kích hoạt khi INSERT/UPDATE cột: value, expected_revenue,   │
│    estimated_cost, actual_revenue                              │
└─────────────────────────────────────────────────────────────────┘
              │
              ▼
┌─────────────────────────────────────────────────────────────────┐
│                   SERVICE LAYER (TypeScript)                     │
│                                                                 │
│  contractFinancials.ts  — Hàm thuần túy tính toán              │
│  contractMapper.ts      — DB row → Frontend Contract object    │
│  contractService.ts     — CRUD + getStats + getChartData       │
│  contractUtils.ts       — buildPayload (Frontend → DB)         │
│  companyTargetService   — Chỉ tiêu ĐHCĐ (mục tiêu năm)       │
│                                                                 │
│  useFinancialCalculations.ts — Hook tính toán cho form/detail  │
│  useLineItems.ts             — Hook quản lý line items + cost  │
└─────────────────────────────────────────────────────────────────┘
              │
              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      VIEW LAYER (React)                         │
│                                                                 │
│  Dashboard.tsx              — KPI cards, biểu đồ tổng hợp     │
│  ContractList.tsx           — Bảng danh sách + metrics bar     │
│  ContractListTableRow.tsx   — Từng dòng HĐ (có allocation)    │
│  ContractDetail.tsx         — Chi tiết 1 HĐ                   │
│  ContractOverviewTab.tsx    — Tab Tổng quan (tài chính+chứng từ)│
│  ContractBusinessPlanTab    — Tab PAKĐ (lập kế hoạch)          │
│  ContractForm               — Form tạo/sửa HĐ                 │
│  CompanyTargetManager       — Cài đặt chỉ tiêu ĐHCĐ           │
└─────────────────────────────────────────────────────────────────┘
```

---

## 2. CÁC CHỈ SỐ TÀI CHÍNH CỐT LÕI

| # | Tên chỉ số | Tiếng Anh (code) | Đơn vị | Ý nghĩa |
|---|-----------|-------------------|--------|---------|
| 1 | **Giá trị ký kết** | `value` / `signingValue` | VNĐ | Tổng giá trị hợp đồng (bao gồm VAT) |
| 2 | **Doanh thu dự kiến** | `expectedRevenue` / `estimatedRevenue` | VNĐ | Giá trị đầu ra trước thuế VAT (= Σ outputPrice × quantity) |
| 3 | **Chi phí dự kiến** | `estimatedCost` | VNĐ | Tổng chi phí ước tính (đầu vào + trực tiếp + thực hiện) |
| 4 | **Doanh thu thực tế** | `actualRevenue` | VNĐ | Doanh thu đã ghi nhận (từ hóa đơn VAT đã xuất, trước thuế) |
| 5 | **LNG Quản trị** | `adminProfit` | VNĐ | Lợi nhuận gộp quản trị = DT dự kiến − CP dự kiến |
| 6 | **LNG theo Doanh thu** | `revProfit` | VNĐ | Lợi nhuận theo doanh thu thực tế = (DT thực tế / DT dự kiến) × LNG QT |
| 7 | **Tiền về** | `cashReceived` | VNĐ | Tiền thực tế đã thu (phiếu thu RECEIPT status 'Tiền về'/'Tạm ứng') |
| 8 | **Tạm ứng** | `advanceAmount` | VNĐ | Tiền tạm ứng (RECEIPT status 'Tạm ứng' — chưa có hóa đơn VAT) |
| 9 | **Số tiền đã xuất HĐ** | `invoicedAmount` | VNĐ | Tổng giá trị hóa đơn VAT đã xuất (sau thuế) |
| 10 | **Công nợ phải thu** | `receivables` | VNĐ | Đã xuất HĐ VAT − Tiền về |
| 11 | **Công nợ phải trả** | `payables` | VNĐ | Tổng chi phí đầu vào − Tổng phiếu chi (EXPENSE) |
| 12 | **Tỷ suất lợi nhuận** | `profitMargin` / `margin` | % | LNG QT / DT dự kiến × 100 |
| 13 | **Lợi nhuận gộp** | `grossProfit` | VNĐ | DT dự kiến − Tổng chi phí (dùng trong form/detail) |

---

## 3. LUỒNG DỮ LIỆU

### 3.1. Khi tạo/sửa hợp đồng (ContractForm)

```
User nhập line items:
  → name, quantity, inputPrice, outputPrice, vatRate, directCosts, supplier
  → executionCosts (chi phí thực hiện: phí chuyển tiền, thuế nhà thầu...)

  ┌─ useFinancialCalculations hook tính realtime ──────────────────┐
  │                                                                │
  │  signingValue = Σ (outputPrice × quantity × (1 + vatRate%))    │
  │  estimatedRevenue = Σ (outputPrice × quantity)                 │
  │  totalInput = Σ (inputPrice × quantity)                        │
  │  totalDirectCosts = Σ directCosts (hoặc sum directCostDetails) │
  │  executionCostsSum = Σ executionCosts[].amount                 │
  │  totalCosts = totalInput + totalDirectCosts + executionCostsSum│
  │  grossProfit = estimatedRevenue − totalCosts                   │
  │  profitMargin = grossProfit / estimatedRevenue × 100           │
  └────────────────────────────────────────────────────────────────┘

Khi SAVE → buildPayload():
  → Tính estimated_cost = Σ(inputPrice × qty + directCosts) + Σ(execCosts)
  → Lưu details JSONB = { lineItems, executionCosts }
  → Lưu value = signingValue (giá trị ký kết sau thuế)
```

### 3.2. Khi dữ liệu vào DB → Trigger tự động tính

```sql
TRIGGER calculate_contract_profits() — chạy khi INSERT/UPDATE

  1. expected_revenue = 
       NẾU contract đã có expected_revenue > 0 → giữ nguyên
       NẾU có VAT → value / (1 + vat_rate / 100)
       NẾU không VAT → value

  2. admin_profit = expected_revenue − estimated_cost

  3. rev_profit = 
       NẾU expected_revenue > 0:
         (actual_revenue / expected_revenue) × admin_profit
       NGƯỢC LẠI: 0
```

### 3.3. Khi đọc ra (mapContract) — DB → Frontend

```
contractMapper.ts — mapContract(dbRow):

  1. Lấy payments[] (JOIN từ payments table)
  2. Tính lại financial metrics từ payments:
     - actualRevenue:  Ưu tiên DB actual_revenue, fallback → tính từ payments
     - invoicedAmount: Tổng VAT_INVOICE đã xuất (sau thuế)
     - cashReceived:   Tổng RECEIPT đã thu
     - advanceAmount:  Tổng RECEIPT status='Tạm ứng'
     - receivables:    invoicedAmount − cashReceived
     - payables:       totalInputCost − Σ EXPENSE 'Đã chi'
     
  3. Lấy profit metrics từ DB (ưu tiên) hoặc tính lại:
     - adminProfit:     DB admin_profit || (expectedRevenue − estimatedCost)
     - revProfit:       DB rev_profit || (actualRevenue/expectedRevenue × adminProfit)
     - expectedRevenue: DB expected_revenue || Σ(outputPrice × qty) || value/(1+VAT%)
     
  4. Tính warning flags (xem mục 8)
```

### 3.4. Dashboard — Tổng hợp toàn bộ hợp đồng

```
ContractService.getStatsFallback(unitId, year, periodFilter):

  ┌─ Fetch TẤT CẢ contracts (có payments JOIN) ─────────────────┐
  │                                                                │
  │  Với MỖI hợp đồng:                                           │
  │    1. Tính allocation fraction (phân bổ đơn vị)              │
  │    2. NẾU signed_date nằm trong kỳ lọc:                     │
  │       → totalContracts++                                      │
  │       → totalValue += value × fraction                        │
  │       → totalSigningProfit += adminProfit × fraction          │
  │       → Đếm status (processing/suspended/handover/...)       │
  │    3. Với MỖI payment:                                        │
  │       → NẾU VAT_INVOICE + invoice_date trong kỳ:             │
  │          totalRevenue += preVatAmount × fraction              │
  │       → NẾU RECEIPT + payment_date trong kỳ:                 │
  │          totalCash += amount × fraction                       │
  │    4. totalRevenueProfit += rev trong kỳ × profitRatio × fraction│
  │       (profitRatio = expectedProfit / expectedRevenue)        │
  └────────────────────────────────────────────────────────────────┘
  
  *** LƯU Ý QUAN TRỌNG ***
  - Ký kết: lọc theo signed_date (ngày ký HĐ)
  - Doanh thu: lọc theo invoice_date/payment_date (ngày xuất HĐ VAT)
  - Tiền về: lọc theo payment_date (ngày nhận tiền)
  → 3 chỉ số này KHÔNG cùng nguồn ngày lọc!
```

---

## 4. CHI TIẾT TỪNG CHỈ SỐ & CÔNG THỨC

### 4.1. Giá trị ký kết (Signing Value)

```
signingValue = Σ [outputPrice × quantity × (1 + vatRate / 100)]
```

- Mỗi line item có thể có `vatRate` riêng (0%, 8%, 10%)
- `outputPrice` có thể đến từ `outputPriceFormula` (dùng `safeEval` để tính)
- File: `useFinancialCalculations.ts:43`

### 4.2. Doanh thu dự kiến (Expected Revenue)

```
expectedRevenue = Σ [outputPrice × quantity]   (tổng giá đầu ra TRƯỚC thuế)
```

- Fallback khi không có lineItems: `value / (1 + vatRate / 100)`
- Được lưu vào DB cột `expected_revenue` bởi trigger
- File: `contractFinancials.ts:165-170`, `contractMapper.ts:76-83`

### 4.3. Chi phí dự kiến (Estimated Cost)

```
estimatedCost = Σ [inputPrice × quantity + directCosts] + Σ executionCosts[].amount
                    └─── per line item ───┘                └─── chi phí thực hiện ──┘
```

Trong đó `directCosts` cho mỗi line item:
```
directCosts = MAX(directCosts field, Σ directCostDetails[].amount)
```

Các loại directCost phổ biến:
- **Thuế nhà thầu** (Contractor Tax): `inputTotal / 0.9 × 0.1` ≈ 11.11% giá đầu vào
- **Phí chuyển tiền trong nước**: `MAX(supplierTotalValue × 0.07%, 22,000 VNĐ)` — chia tỷ lệ theo giá trị item
- **Phí chuyển tiền quốc tế**: `itemValue × 0.5% + $10 × tỷ giá USD` — chia tỷ lệ theo giá trị item

File: `contractUtils.ts:170-185`, `useLineItems.ts:97-148`, `DirectCostModal.tsx`

### 4.4. Doanh thu thực tế (Actual Revenue)

```
actualRevenue = Σ [preVatAmount cho mỗi VAT_INVOICE đã xuất]
```

Điều kiện payment được tính:
- `voucher_type = 'VAT_INVOICE'`
- `status IN ('Đã xuất HĐ', 'Đã giao KH', 'Tiền về', 'Paid')`

Cách tính preVatAmount:
```
NẾU payment có vat_invoice_items[]:
  preVatAmount = Σ item.amountBeforeVAT
NGƯỢC LẠI:
  preVatAmount = amount / (1 + vatRate / 100)
```

File: `contractFinancials.ts:49-83`

### 4.5. LNG Quản trị (Admin Profit)

```
adminProfit = expectedRevenue − estimatedCost
            = (DT dự kiến trước thuế) − (Tổng chi phí dự kiến)
```

- Tính tại thời điểm ký HĐ, dựa trên ước tính
- Được trigger DB auto-tính khi `value`, `estimated_cost` thay đổi
- File: `contractFinancials.ts:176-178`

### 4.6. LNG theo Doanh thu (Revenue Profit)

```
revProfit = (actualRevenue / expectedRevenue) × adminProfit
```

Ý nghĩa: Khi doanh thu thực tế = 50% doanh thu dự kiến → LNG DT = 50% × LNG QT

Trường hợp đặc biệt:
- `expectedRevenue = 0` → `revProfit = 0`
- Khi HĐ hoàn thành 100% doanh thu: `revProfit ≈ adminProfit`
- File: `contractFinancials.ts:184-191`

### 4.7. Tiền về (Cash Received)

```
cashReceived = Σ [amount cho mỗi RECEIPT]
```

Điều kiện:
- `voucher_type = 'RECEIPT'`
- `status IN ('Tạm ứng', 'Tiền về', 'Paid')`

File: `contractFinancials.ts:102-107`

### 4.8. Số tiền đã xuất HĐ (Invoiced Amount)

```
invoicedAmount = Σ [amount cho mỗi VAT_INVOICE đã xuất]
```

*Lưu ý: Đây là số SAU thuế VAT (gross amount), khác với actualRevenue là trước thuế.*

File: `contractFinancials.ts:90-96`

### 4.9. Công nợ phải thu (Receivables)

```
receivables = invoicedAmount − cashReceived
            = (Đã xuất HĐ VAT) − (Tiền đã thu)
```

File: `contractFinancials.ts:124-128`

### 4.10. Công nợ phải trả (Payables)

```
payables = totalInputCost − Σ EXPENSE['Đã chi']
         = (Tổng giá đầu vào) − (Tổng đã chi cho NCC)
```

File: `contractFinancials.ts:134-139`

---

## 5. HỆ THỐNG PHÂN BỔ ĐA ĐƠN VỊ (ALLOCATION)

Theo QĐ 09.2024, một hợp đồng có thể được phân bổ cho nhiều đơn vị:

```
unit_allocations.allocations = [
  { unitId: "P.KD1", percent: 70, role: "lead",    employeeId: "emp1" },
  { unitId: "P.KD2", percent: 30, role: "support", employeeId: "emp2" }
]
```

### Cách tính phân bổ:

```typescript
// Hàm getUnitSharePct(contract, targetUnitId) → 0-100%
// File: contractFinancials.ts:20-41

NẾU là đơn vị chủ trì (lead) VÀ có allocations:
  → Lấy leadAlloc.percent (mặc định 100%)
NẾU là đơn vị chủ trì KHÔNG có allocations:
  → 100% (toàn bộ)
NẾU là đơn vị phối hợp (support):
  → Lấy supportAlloc.percent
NGƯỢC LẠI:
  → 0% (không liên quan)
```

### Áp dụng khi hiển thị:

```
fraction = unitSharePct / 100

// Mọi chỉ số tài chính đều nhân fraction:
displayValue     = contract.value × fraction
displayRevenue   = contract.actualRevenue × fraction
displayProfit    = contract.adminProfit × fraction
displayCash      = contract.cashReceived × fraction
```

### Phân bổ nhân viên (Employee Allocation):

```
employee_allocations = [
  { employeeId: "emp1", percent: 60 },
  { employeeId: "emp3", percent: 40 }
]

// Combined fraction khi lọc theo cả đơn vị + nhân viên:
fraction = (unitSharePct / 100) × (employeeSharePct / 100)
```

File: `ContractListTableRow.tsx:64-72`, `contractService.ts:676-681`

---

## 6. TRIGGER & RPC Ở TẦNG DATABASE

### 6.1. Trigger `calculate_contract_profits()`

```sql
-- File: 20260522111000_add_expected_revenue_column.sql

BEFORE INSERT OR UPDATE OF value, expected_revenue, estimated_cost, actual_revenue
ON contracts

Bước 1: Xác định expected_revenue
  NẾU expected_revenue > 0 → giữ nguyên
  NẾU có VAT → value / (1 + vat_rate/100)
  NẾU không → value

Bước 2: admin_profit = expected_revenue − estimated_cost

Bước 3: rev_profit = (actual_revenue / expected_revenue) × admin_profit
```

### 6.2. Hàm `Math_Round_To_Int()`

```sql
-- Hàm phụ trợ làm tròn số nguyên
Math_Round_To_Int(val NUMERIC) → ROUND(val)
```

### 6.3. Không có RPC stats (đã bị bypass)

```typescript
// contractService.ts:732-741
// getStatsRPC() → FORCE FALLBACK → getStatsFallback()
// getChartDataRPC() → FORCE FALLBACK → getChartDataFallback()
// Lý do: RPC bị timeout issues, dùng direct query + JS aggregation
```

---

## 7. BẢNG TỔNG HỢP: CHỈ SỐ → VIEW HIỂN THỊ

| Chỉ số | Dashboard | ContractList | ContractDetail | ContractForm | PAKĐ Tab |
|--------|:---------:|:------------:|:--------------:|:------------:|:--------:|
| Giá trị ký kết (value) | ✅ KPI Card "Ký kết" | ✅ Cột "Giá trị" | ✅ Header | ✅ Tự tính | ✅ |
| Doanh thu dự kiến (expectedRevenue) | — | — | ✅ (via hook) | ✅ estimatedRevenue | ✅ |
| Chi phí dự kiến (estimatedCost) | — | — | ✅ totalCosts | ✅ totalCosts | ✅ |
| Doanh thu thực tế (actualRevenue) | ✅ KPI Card "Doanh thu" | ✅ Cột "DT" | ✅ | — | — |
| LNG Quản trị (adminProfit) | ✅ KPI Card "LNG QT" | ✅ Cột "LNG QT" | ✅ | — | — |
| LNG theo DT (revProfit) | ✅ KPI Card "LNG DT" | ✅ Cột "LNG DT" | ✅ | — | — |
| Tiền về (cashReceived) | ✅ KPI Card "Tiền về" | ✅ Cột "Tiền về" | ✅ | — | — |
| Tạm ứng (advanceAmount) | — | ✅ Cột "Tạm ứng" | ✅ | — | — |
| Số tiền xuất HĐ (invoicedAmount) | — | — | ✅ | — | — |
| Công nợ phải thu (receivables) | — | — | ✅ | — | — |
| Công nợ phải trả (payables) | — | — | ✅ | — | — |
| Lợi nhuận gộp (grossProfit) | — | — | ✅ (tab PAKĐ) | ✅ | ✅ |
| Tỷ suất LN (margin) | — | ✅ Cột "TSLN" | ✅ (tab PAKĐ) | ✅ | ✅ |
| Trạng thái đếm | ✅ Status cards | ✅ Metrics bar | — | — | — |
| Phân bổ (allocation %) | — | ✅ Badge + tooltip | — | — | — |
| Cảnh báo (warnings) | — | ✅ Badges | ✅ | — | — |
| Chỉ tiêu ĐHCĐ (target) | ✅ Progress bars | — | — | — | — |
| Biểu đồ tháng | ✅ ComposedChart | — | — | — | — |

### Chi tiết từng View:

**Dashboard (`Dashboard.tsx`)**
- 5 KPI cards chính: Ký kết | Doanh thu | LNG QT | LNG DT | Tiền về
- So sánh với chỉ tiêu ĐHCĐ (% hoàn thành)
- So sánh với năm trước (historical_productions)
- Biểu đồ ComposedChart theo tháng (Bar: ký kết, Line: DT, revProfit)
- Status cards: Processing | Suspended | Handover | Acceptance | Completed
- Performance table: phân tích theo đơn vị/nhân viên

**ContractList (`ContractList.tsx` + `ContractListTableRow.tsx`)**
- Metrics summary bar: totalContracts, totalValue, totalRevenue, totalProfit, totalRevenueProfit, totalCash
- Mỗi dòng hiển thị: Giá trị, DT, LNG QT, LNG DT, Tiền về, Tạm ứng, TSLN
- Badge phân bổ (lead/support + %)
- Warning badges (quá hạn tạm ứng, quá hạn thanh toán, nghiệm thu chưa xuất HĐ)

**ContractDetail (`ContractDetail.tsx` + `ContractOverviewTab.tsx`)**
- Header: Giá trị ký, DT dự kiến, Tổng CP, LN gộp, Tỷ suất
- Sidebar financials: actualRevenue, cashReceived, invoicedAmount, receivables, payables
- Danh sách chứng từ (Vouchers): VAT_INVOICE, RECEIPT, EXPENSE
- Tab PAKĐ: Line items chi tiết + financial summary

**ContractForm (`ContractForm.tsx` + `useFinancialCalculations`)**
- Tính toán realtime khi nhập line items
- Hiển thị: signingValue, estimatedRevenue, totalCosts, grossProfit, profitMargin

---

## 8. CẢNH BÁO TỰ ĐỘNG (WARNING FLAGS)

Được tính trong `contractMapper.ts` (không lưu DB — derived):

| Cảnh báo | Điều kiện | Hiển thị |
|----------|-----------|----------|
| ⚠️ Quá hạn tạm ứng (`isOverdueAdvance`) | Có payment schedule tạm ứng + date < hôm nay + cashReceived = 0 | ContractList badge |
| 🔴 Quá hạn thanh toán (`isOverduePayment`) | invoicedAmount > 0 + cashReceived < invoicedAmount + có payment quá due_date | ContractList badge |
| 📄 Nghiệm thu chưa xuất HĐ (`isAcceptedNoInvoice`) | status = 'Acceptance' + invoicedAmount = 0 | ContractList badge |

---

## 9. CHỈ TIÊU ĐHCĐ (COMPANY TARGET)

File: `companyTargetService.ts`, `CompanyTargetManager.tsx`

```typescript
interface CompanyTarget {
  year: number;
  signing: number;      // Chỉ tiêu ký kết
  revenue: number;      // Chỉ tiêu doanh thu
  adminProfit: number;  // Chỉ tiêu LNG QT
  revProfit: number;    // Chỉ tiêu LNG DT (= adminProfit theo quy tắc nghiệp vụ)
  cash: number;         // Chỉ tiêu tiền về
}
```

Quy tắc đặc biệt: `revProfit = adminProfit` (LNG DT = LNG QT) — theo quy ước nghiệp vụ khi lập chỉ tiêu.

Dashboard hiển thị % hoàn thành = `actual / target × 100` cho từng chỉ số.

---

## 10. TÓM TẮT LUỒNG LIÊN KẾT

```
ContractForm (nhập liệu)
    │
    ├── useLineItems → quản lý line items + direct costs
    ├── useFinancialCalculations → tính realtime (signingValue, grossProfit, margin)
    │
    └── SAVE → buildPayload() → DB INSERT/UPDATE
                                     │
                                     ▼
                          TRIGGER calculate_contract_profits()
                          → auto-tính: expected_revenue, admin_profit, rev_profit
                                     │
                                     ▼
                          mapContract() ← DB SELECT (+ payments JOIN)
                          → tính: actualRevenue, cashReceived, invoicedAmount,
                            receivables, payables, advanceAmount, warnings
                                     │
                    ┌────────────────┼────────────────┐
                    ▼                ▼                ▼
              Dashboard        ContractList     ContractDetail
              (getStatsFallback)  (list + getStats)  (getById)
              → aggregate all    → per-contract      → single contract
              → allocation-aware → allocation-aware   → full details
              → period-filtered  → period-filtered    → vouchers
```

---

## 11. ĐÁNH GIÁ: TÍNH NHẤT QUÁN NGUỒN DỮ LIỆU (SINGLE SOURCE OF TRUTH)

> **Nguyên tắc kiểm tra:** Mỗi chỉ số tài chính chỉ nên có **1 nguồn tính toán duy nhất** 
> (hoặc 1 hàm duy nhất), và các view khác nhau phải **dùng lại** giá trị đã tính sẵn 
> thay vì **tính lại** bằng công thức riêng. Vi phạm nguyên tắc này dẫn đến:
> - Số liệu không khớp giữa các view (Dashboard nói 1 đằng, ContractList nói 1 nẻo)
> - Khi sửa logic tính toán, phải sửa ở nhiều chỗ → dễ bỏ sót
> - Khi dữ liệu chưa được sync/cache → view hiện giá trị cũ

### BẢNG ĐÁNH GIÁ TỪNG CHỈ SỐ

| # | Chỉ số | Số nguồn tính | Đánh giá | Mức rủi ro |
|---|--------|:-------------:|----------|:----------:|
| 1 | Giá trị ký kết (value) | 1 ✅ | Nguồn duy nhất: DB `contracts.value`. Tất cả view đều đọc từ đây | 🟢 An toàn |
| 2 | Doanh thu dự kiến (expectedRevenue) | **4 ❌** | Tính lại ở 4 nơi khác nhau, công thức khác nhau | 🔴 **Nghiêm trọng** |
| 3 | Chi phí dự kiến (estimatedCost) | 2 ⚠️ | DB trigger lưu sẵn + buildPayload tính khi save. Hợp lý nhưng cẩn thận | 🟡 Chấp nhận |
| 4 | Doanh thu thực tế (actualRevenue) | 2 ⚠️ | mapContract fallback + getStatsFallback tính riêng theo kỳ | 🟡 Có lý do |
| 5 | LNG Quản trị (adminProfit) | **3 ❌** | DB trigger + mapContract fallback + getStatsFallback tính lại | 🔴 **Nghiêm trọng** |
| 6 | LNG theo DT (revProfit) | **4 ❌** | DB trigger + mapContract + getStatsFallback + getChartDataFallback | 🔴 **Nghiêm trọng** |
| 7 | Tiền về (cashReceived) | 2 ⚠️ | mapContract (từ payments) + getStatsFallback (tính theo kỳ) | 🟡 Có lý do |
| 8 | Tạm ứng (advanceAmount) | 1 ✅ | Chỉ tính trong mapContract | 🟢 An toàn |
| 9 | Số tiền xuất HĐ (invoicedAmount) | 1 ✅ | Chỉ tính trong mapContract | 🟢 An toàn |
| 10 | Công nợ phải thu (receivables) | 1 ✅ | Chỉ tính trong mapContract | 🟢 An toàn |
| 11 | Công nợ phải trả (payables) | 1 ✅ | Chỉ tính trong mapContract | 🟢 An toàn |
| 12 | Tỷ suất LN (margin) | **3 ❌** | useFinancialCalculations + ContractListTableRow + businessPlanPdf | 🔴 **Nghiêm trọng** |
| 13 | Lợi nhuận gộp (grossProfit) | 2 ⚠️ | useFinancialCalculations + PAKDGenerator. Cùng công thức | 🟡 Nhẹ |

---

### CHI TIẾT CÁC VI PHẠM NGHIÊM TRỌNG

#### ❌ VẤN ĐỀ 1: `expectedRevenue` — 4 nguồn tính, 2 công thức khác nhau

**Nguồn A: DB Trigger** (`20260522111000_add_expected_revenue_column.sql`)
```sql
-- Ưu tiên expected_revenue nếu đã có > 0, fallback: value / (1 + vat_rate/100)
IF NEW.expected_revenue IS NOT NULL AND NEW.expected_revenue > 0 THEN
    v_expected_revenue := NEW.expected_revenue;
ELSIF NEW.has_vat IS NOT FALSE AND COALESCE(NEW.vat_rate, 10) > 0 THEN
    v_expected_revenue := value / (1 + vat_rate / 100);
```

**Nguồn B: contractMapper.ts:76-83** — dùng khi đọc 1 HĐ (ContractDetail, ContractList)
```typescript
// Ưu tiên Σ(outputPrice × qty) từ lineItems, fallback value/(1+VAT%)
const fallbackExpectedRevenue = calculateExpectedRevenue(lineItems) || (
    c.has_vat !== false && (c.vat_rate ?? 10) > 0
        ? Math.round((c.value || 0) / (1 + (c.vat_rate ?? 10) / 100))
        : (c.value || 0)
);
const expectedRevenue = c.expected_revenue ?? fallbackExpectedRevenue;
// ★ Dùng Σ(outputPrice × qty) nếu có lineItems — KHÁC với trigger DB chỉ dùng value/(1+VAT%)
```

**Nguồn C: getStatsFallback** (`contractService.ts:842-844`) — dùng cho Dashboard
```typescript
// Ưu tiên DB expected_revenue, fallback: value/(1+VAT%) — KHÔNG dùng lineItems
const expectedRevenue = curr.expected_revenue !== null
    ? Number(curr.expected_revenue)
    : (hasVat && vatRate > 0 ? Math.round(val / (1 + vatRate / 100)) : val);
```

**Nguồn D: getChartDataFallback + unitService.ts:258** — dùng cho biểu đồ + bảng đơn vị
```typescript
// KHÔNG kiểm tra DB expected_revenue — luôn tính lại từ value/(1+VAT%)
const expectedRevenue = hasVat && vatRate > 0 ? Math.round(val / (1 + vatRate / 100)) : val;
// ★ BỎ QUA hoàn toàn DB expected_revenue → khi lineItems có giá khác value/(1+VAT%), sẽ SAI
```

**🔥 Hậu quả thực tế:**
Khi 1 HĐ có lineItems với VAT rate hỗn hợp (VD: item1 = 10% VAT, item2 = 0% VAT):
- `Σ(outputPrice × qty)` ≠ `value / (1 + 10/100)` vì VAT rate khác nhau
- ContractDetail hiện **đúng** (dùng lineItems)
- Dashboard biểu đồ hiện **sai** (dùng value/1.1 đồng nhất)
- ContractList có thể **đúng hoặc sai** tùy DB đã cache chưa

---

#### ❌ VẤN ĐỀ 2: `adminProfit` — 3 nguồn tính

| Nơi tính | Công thức | Khi nào chạy |
|----------|-----------|-------------|
| DB Trigger | `expected_revenue − estimated_cost` | Khi INSERT/UPDATE contracts |
| mapContract | `calculateAdminProfit(expectedRevenue, estimatedCost)` | Khi getById/list (fallback nếu DB null) |
| getStatsFallback | `expectedRevenue − estimatedCost` (inline) | Khi Dashboard load |

**🔥 Hậu quả:**
- getStats (dùng cho ContractList metrics bar) lại đọc `curr.admin_profit` trực tiếp từ DB → **nhất quán** ✅
- getStatsFallback (dùng cho Dashboard) tính lại từ `expectedRevenue − estimatedCost` nhưng `expectedRevenue` dùng **Nguồn C** (khác Nguồn B) → **có thể sai** ❌
- mapContract dùng DB value khi có, fallback khác → OK nhưng fallback dùng **Nguồn B** → nếu trigger chưa chạy, khác Dashboard

---

#### ❌ VẤN ĐỀ 3: `revProfit` (LNG DT) — 4 nguồn tính, logic phức tạp nhất

| Nơi tính | Cách tính | File:line |
|----------|-----------|-----------|
| DB Trigger | `(actual_revenue / expected_revenue) × admin_profit` | SQL trigger |
| mapContract | `calculateRevProfit(actualRevenue, expectedRevenue, adminProfit)` — fallback | contractMapper.ts:93-94 |
| getStats | Đọc `curr.rev_profit` từ DB (nhất quán ✅) | contractService.ts:657 |
| getStatsFallback | `contractRevInPeriod × profitRatio × fraction` — **logic khác hoàn toàn** | contractService.ts:903-905 |
| getChartDataFallback | `preVatAmount × profitRatio × fraction` — theo tháng | contractService.ts:1173-1174 |
| unitService.getWithStats | `contractRevInPeriod × profitRatio × fraction` — copy-paste | unitService.ts:301-302 |

**🔥 Hậu quả nghiêm trọng:**

Dashboard và biểu đồ tính `revProfit` theo **cách hoàn toàn khác** so với DB trigger:

```
DB Trigger:      revProfit = (actual_revenue / expected_revenue) × admin_profit
                            ↑ tổng DT thực tế toàn HĐ ÷ DT dự kiến

Dashboard:       revProfit = contractRevInPeriod × (expectedProfit / expectedRevenue)
                            ↑ DT thực tế TRONG KỲ × tỷ suất LN
```

Hai công thức này cho **cùng kết quả** khi xem ALL (cả năm, không lọc kỳ).
Nhưng khi **lọc theo tháng/quý** → Dashboard tính `revProfit theo kỳ` trong khi DB chỉ lưu `revProfit tổng`.
→ Đây là **design by intent** (cố ý) nhưng dễ gây nhầm lẫn vì cùng tên `revProfit`.

---

#### ❌ VẤN ĐỀ 4: `margin` (Tỷ suất LN) — 3 nguồn, 2 công thức khác nhau

| Nơi tính | Công thức | Dùng ở đâu |
|----------|-----------|-----------|
| useFinancialCalculations | `grossProfit / estimatedRevenue × 100` = `(DT dự kiến − Tổng CP) / DT dự kiến` | ContractForm, ContractDetail, PAKĐ Tab |
| ContractListTableRow:124 | `adminProfit / expectedRevenue × 100` — với expectedRevenue **tính lại** từ lineItems | ContractList mỗi dòng |
| businessPlanPdf.ts:74 | `grossProfit / estimatedRevenue × 100` | PDF export |

**🔥 Khác biệt nguy hiểm:**

```
ContractForm/Detail:
  margin = grossProfit / estimatedRevenue
         = (estimatedRevenue − totalCosts) / estimatedRevenue
  Trong đó totalCosts = totalInput + totalDirectCosts + executionCostsSum
  
ContractListTableRow:
  margin = adminProfit / expectedRevenue
         = (expectedRevenue − estimatedCost) / expectedRevenue
  ★ expectedRevenue tính lại: Σ(outputPrice × qty) × allocFraction
  ★ adminProfit lấy từ contract.adminProfit (DB hoặc mapContract)
```

Về lý thuyết `grossProfit ≈ adminProfit` (cùng là DT dự kiến − CP dự kiến),
nhưng:
- `estimatedRevenue` (hook) = Σ(outputPrice × qty) — **từ lineItems gốc**
- `expectedRevenue` (ListTableRow) = Σ(outputPrice × qty) × allocFraction — **đã nhân fraction**
- `adminProfit` (ListTableRow) = từ DB trigger — dùng `value/(1+VAT%)` làm DT dự kiến

→ Khi HĐ có lineItems với VAT hỗn hợp: **ContractDetail** và **ContractList** hiện margin **khác nhau** cho cùng 1 HĐ.

---

### BẢN ĐỒ TÍNH TRÙNG LẶP (DUPLICATE CALCULATION MAP)

```
expected_revenue tính ở:
  ├── [A] DB Trigger ───────────────── lưu vào contracts.expected_revenue
  ├── [B] contractMapper.ts:76-83 ─── fallback khi đọc 1 HĐ (ưu tiên lineItems)
  ├── [C] getStatsFallback:842-844 ── fallback khi tổng hợp Dashboard
  ├── [D] getChartDataFallback:1130 ── LUÔN tính lại, BỎ QUA DB cache ❌
  └── [E] unitService.ts:258 ───────── LUÔN tính lại, BỎ QUA DB cache ❌

admin_profit tính ở:
  ├── [A] DB Trigger ───────────────── lưu vào contracts.admin_profit
  ├── [B] contractMapper.ts:87-89 ─── fallback khi DB null
  └── [C] getStatsFallback:845-847 ── fallback khi DB null (dùng expectedRevenue nguồn C)

rev_profit tính ở:
  ├── [A] DB Trigger ───────────────── lưu vào contracts.rev_profit
  ├── [B] contractMapper.ts:93-94 ─── fallback khi DB null
  ├── [C] getStats:657 ────────────── đọc trực tiếp DB ✅
  ├── [D] getStatsFallback:903-905 ── tính lại theo kỳ (logic khác trigger)
  ├── [E] getChartDataFallback:1173 ─ tính lại theo tháng (logic khác trigger)
  └── [F] unitService.ts:301 ──────── copy-paste logic D

margin tính ở:
  ├── [A] useFinancialCalculations ── grossProfit / estimatedRevenue
  ├── [B] ContractListTableRow:124 ── adminProfit / Σ(outputPrice×qty)×fraction ❌ KHÁC A
  ├── [C] PAKDGenerator:76 ────────── grossProfit / totalRevenue (giống A)
  └── [D] businessPlanPdf:74 ──────── grossProfit / estimatedRevenue (giống A)

Doanh thu thực tế (actualRevenue) tính ở:
  ├── [A] mapContract ──────────────── calculateRevenueFromPayments() — tổng toàn HĐ
  └── [B] getStatsFallback:872-888 ── inline tính lại — lọc payment theo kỳ (khác A)
  (B khác A là CỐ Ý — Dashboard cần DT theo kỳ, không phải tổng)

cashReceived tính ở:
  ├── [A] mapContract ──────────────── calculateCashReceived() — tổng toàn HĐ
  └── [B] getStatsFallback:891-897 ── inline tính lại — lọc payment theo kỳ
  (B khác A là CỐ Ý — Dashboard cần tiền về theo kỳ)
```

---

### TÓM TẮT VÀ KHUYẾN NGHỊ

#### Các vấn đề cần sửa (ưu tiên cao → thấp):

| # | Vấn đề | Mức độ | Khuyến nghị |
|---|--------|--------|-------------|
| 1 | `getChartDataFallback` và `unitService.getWithStats` **bỏ qua** DB `expected_revenue`, luôn tính `value/(1+VAT%)` | 🔴 Cao | Đọc `expected_revenue` từ DB trước, chỉ fallback khi null. Giống cách `getStatsFallback` đã làm |
| 2 | `ContractListTableRow` tính `margin` bằng công thức khác `ContractDetail` | 🔴 Cao | Lưu `margin` vào Contract object trong `mapContract`, cả 2 view đọc từ đó |
| 3 | `ContractListTableRow` tính `expectedRevenue` **riêng** bằng `Σ(outputPrice×qty)` thay vì dùng giá trị đã lưu | 🔴 Cao | Dùng `contract.expectedRevenue` (đã tính trong mapContract) thay vì tính lại từ lineItems |
| 4 | Copy-paste logic revenue/profit giữa `getStatsFallback`, `getChartDataFallback`, `unitService.getWithStats` | 🟡 Trung bình | Extract hàm chung `calculatePeriodFinancials(contract, period)` dùng ở cả 3 |
| 5 | `recalculate-financials.ts` và `recalculate-legacy-transfer-fees.ts` copy lại hàm `calculateRevenueFromPayments` thay vì import | 🟡 Nhẹ | Đây là script 1 lần, chấp nhận được. Nếu chạy lại thì cần kiểm tra logic còn khớp không |
| 6 | Dashboard `getStatsFallback` tính `revProfit` theo kỳ (cố ý khác DB) nhưng dùng cùng tên biến | 🟡 Trung bình | Đổi tên thành `revProfitInPeriod` để tránh nhầm với `rev_profit` tổng trong DB |

#### Nguyên tắc thiết kế cần tuân thủ:

```
1. SINGLE SOURCE: Mỗi chỉ số có 1 nơi tính chính thức (authoritative)
   ┌───────────────────────────────────────────────────────────┐
   │ expected_revenue → DB trigger (authoritative)             │
   │ admin_profit     → DB trigger (authoritative)             │
   │ rev_profit       → DB trigger (authoritative cho tổng)    │
   │ actualRevenue    → mapContract (authoritative cho 1 HĐ)  │
   │ cashReceived     → mapContract (authoritative cho 1 HĐ)  │
   │ margin           → mapContract (nên thêm vào đây)        │
   └───────────────────────────────────────────────────────────┘

2. FALLBACK: Chỉ dùng khi nguồn chính = null (data migration chưa chạy)
   → Khi fallback, PHẢI dùng cùng công thức với nguồn chính

3. PERIOD AGGREGATION: Khi cần tổng hợp theo kỳ (tháng/quý),
   đây là logic MỚI (không phải fallback) → nên đặt tên khác
   VD: revProfitInPeriod, revenueInPeriod — tránh nhầm với giá trị tổng

4. VIEW = READ ONLY: Component chỉ ĐỌC giá trị đã tính sẵn,
   KHÔNG tính lại bằng công thức inline
   → ContractListTableRow KHÔNG nên tính expectedRevenue/margin riêng
```

---

*Báo cáo được tạo bởi Claude Code — khảo sát trực tiếp từ source code.*
