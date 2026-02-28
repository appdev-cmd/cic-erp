# CIC ERP Contract — Đặc tả Hệ thống

> **Phiên bản:** 1.0 — 28/02/2026
> **Mục đích:** Tài liệu đặc tả đầy đủ để tái tạo hệ thống CIC ERP Contract Management.
> Mọi thông số có thể điều chỉnh được đánh dấu `⚙️ CONFIG`.

---

## 1. Tổng quan Dự án

### 1.1. Mô tả
Hệ thống quản lý hợp đồng ERP cho công ty CIC — quản lý toàn bộ vòng đời hợp đồng, khách hàng (CRM), tài chính, nhân sự, sản phẩm/dịch vụ, và quy trình phê duyệt.

### 1.2. Tech Stack

| Thành phần | Công nghệ | Phiên bản | Ghi chú |
|------------|-----------|-----------|---------|
| ⚙️ Framework | React | 19.x | SPA, CSR |
| ⚙️ Build Tool | Vite | 6.x | Dev server port 3000 |
| ⚙️ Language | TypeScript | 5.8.x | Strict mode, noImplicitAny: false |
| ⚙️ CSS | Tailwind CSS (CDN) | Latest | Qua `cdn.tailwindcss.com` |
| ⚙️ Backend/DB | Supabase | Latest | Auth + PostgreSQL + Edge Functions |
| ⚙️ Routing | React Router | 7.x | createBrowserRouter |
| ⚙️ State Management | TanStack React Query | 5.x | Server state caching |
| ⚙️ Animation | Framer Motion | 12.x | Page transitions, micro-animations |
| ⚙️ Charts | Recharts | 3.x | Dashboard + Analytics |
| ⚙️ Icons | Lucide React | 0.563+ | 20px default size |
| ⚙️ Font | Google Fonts - Inter | 300-700 | Primary typography |
| ⚙️ Toast | Sonner | 2.x | Notifications |
| ⚙️ Excel | SheetJS (xlsx) | 0.18.x | Import/Export Excel |
| ⚙️ AI | Google Generative AI + OpenAI | Latest | AI Assistant feature |

### 1.3. Cấu trúc thư mục

```
/                          # Root (cũng là alias @/)
├── index.html             # Entry HTML (Tailwind config + CSS variables)
├── index.tsx              # React mount point
├── types.ts               # TypeScript interfaces & enums
├── constants.tsx           # Labels, mock data, nav items
├── components/            # React components
│   ├── ui/                # 22 reusable UI components
│   ├── workflow/           # 7 approval workflow components
│   ├── contract-form/      # 11 contract form components
│   ├── form-sections/      # 8 form section components
│   ├── layout/             # MainLayout
│   ├── dashboard/          # Dashboard widgets
│   ├── settings/           # Settings sub-components
│   ├── admin/              # Admin panel components
│   └── *.tsx               # 42 page-level components
├── services/              # 23 service files (Supabase CRUD)
├── hooks/                 # 10 custom hooks
├── contexts/              # AuthContext, ImpersonationContext
├── lib/                   # Utilities (supabase client, permissions, theme)
├── routes/                # AppRoutes.tsx + routes.ts
├── styles/                # tokens.css (design tokens)
├── supabase/
│   ├── migrations/        # 54 SQL migration files
│   └── functions/         # Edge Functions (gemini-proxy)
└── docs/                  # Documentation
```

---

## 2. Thiết kế Giao diện (UI/UX)

### 2.1. Layout chính
- **Sidebar** (trái): Collapsible, 2 nhóm nav (Quản trị + Danh mục), role-based filtering
- **Header** (trên): User avatar, dark mode toggle, search, notifications
- **Main Content** (giữa): Lazy-loaded pages

### 2.2. Hệ thống màu sắc (⚙️ CONFIG)

#### Light Mode — Professional Slate
```css
--c-slate-50: #f8fafc;   /* Card Bg */
--c-slate-100: #f1f5f9;  /* Main Bg */
--c-slate-200: #e2e8f0;  /* Borders */
--c-slate-400: #94a3b8;  /* Muted icons */
--c-slate-500: #64748b;  /* Secondary text */
--c-slate-800: #1e293b;  /* Headings */
--c-slate-900: #0f172a;  /* Primary text */
```

#### Dark Mode — Fintech Matte Navy
```css
--c-slate-700: #293548;  /* Borders */
--c-slate-800: #1e293b;  /* Input BG / Hover */
--c-slate-900: #151d2e;  /* Card BG */
--c-slate-950: #0b1120;  /* Main BG */
```

#### ⚙️ Accent Colors (2 themes)
| Theme | Primary | Hover | Active |
|-------|---------|-------|--------|
| **Orange (default)** | `#f97316` | `#ea580c` | `#c2410c` |
| **Sky Blue (CIC Classic)** | `#0ea5e9` | `#0284c7` | `#0369a1` |

### 2.3. Typography
- **Font:** Inter (Google Fonts)
- **Weights:** 300 (light), 400 (regular), 500 (medium), 600 (semibold), 700 (bold)

### 2.4. Dark Mode
- Toggle class `dark` trên `<html>`
- CSS variables swap giá trị giữa light/dark
- Custom scrollbar, select, card glow effects cho dark mode

---

## 3. Data Models (types.ts)

### 3.1. Contract (Hợp đồng) — Entity chính

```typescript
interface Contract {
  id: string;                    // Format: "HĐ_XXX/UNIT_CODE"
  title: string;
  contractType: 'HĐ' | 'VV';   // ⚙️ Hợp đồng | Vụ việc
  customerId: string;            // FK → Customer
  isDealerSale?: boolean;
  hasVat?: boolean;              // Default: true
  vatRate?: number;              // ⚙️ 0 | 8 | 10 (default 10)
  endUserId?: string;
  partyA: string;
  partyB: string;
  clientInitials: string;
  contacts: ContractContact[];
  content: string;
  signedDate: string;
  startDate: string;
  endDate: string;
  value: number;                 // Giá trị ký kết
  estimatedCost: number;
  actualRevenue: number;
  invoicedAmount?: number;
  cashReceived?: number;
  actualCost: number;
  status: ContractStatus;        // ⚙️ 5 trạng thái
  stage: ImplementationStage;    // ⚙️ 7 giai đoạn
  category: string;
  unitId: string;                // FK → Unit
  salespersonId: string;         // FK → Employee
  unitAllocations?: UnitAllocation[];      // Phân bổ đơn vị (%)
  employeeAllocations?: EmployeeAllocation[]; // Phân bổ NV (%)
  lineItems?: LineItem[];
  executionCosts?: ExecutionCostItem[];
  milestones?: Milestone[];
  revenueSchedules?: RevenueSchedule[];
  paymentPhases?: PaymentPhase[];
  documents?: ContractDocument[];
  draft_url?: string;
  legal_approved?: boolean;
  finance_approved?: boolean;
}
```

#### ⚙️ Contract Status
| Mã | Label VN | Mô tả |
|----|----------|--------|
| `Processing` | Đang thực hiện | Hợp đồng đang triển khai |
| `Suspended` | Tạm dừng | Tạm ngưng thực hiện |
| `Acceptance` | Nghiệm thu | Đang nghiệm thu |
| `Liquidated` | Thanh lý | Đã thanh lý |
| `Completed` | Hoàn thành | Đã hoàn thành |

#### ⚙️ Implementation Stage
`Signed` → `Advanced` → `Guaranteed` → `InputOrdered` → `Implementation` → `Completed` → `Invoiced`

### 3.2. Customer (Khách hàng/CRM)

```typescript
interface Customer {
  id: string;
  name: string;          // Tên đầy đủ
  shortName: string;     // Tên viết tắt
  industry: string[];    // ⚙️ Ngành nghề (multi-select)
  contactPerson: string;
  phone: string;
  email: string;
  address: string;
  taxCode?: string;
  website?: string;
  notes?: string;
  bankName?: string;
  bankBranch?: string;
  bankAccount?: string;
  type?: 'Customer' | 'Supplier' | 'Both';
  rating?: 'VIP' | 'Gold' | 'Standard' | 'Lead'; // ⚙️ CRM rating
  source?: string;       // ⚙️ Lead source
  paymentTerms?: string; // ⚙️ NET30, NET60, COD, Prepaid
  creditLimit?: number;
  stats?: { contractCount, totalValue, totalRevenue, activeContracts };
}
```

#### ⚙️ Industries
```
Xây dựng, Bất động sản, Năng lượng, Công nghệ, Sản xuất,
Thương mại, Dịch vụ, Giáo dục, Y tế, Khác
```

### 3.3. Employee (Nhân sự)

```typescript
interface Employee {
  id: string;
  name: string;
  unitId: string;        // FK → Unit
  target: KPIPlan;       // Chỉ tiêu KPI
  // General
  email?, phone?, telegram?, position?, department?, roleCode?,
  dateJoined?, employeeCode?
  // HR
  dateOfBirth?, gender?, address?, education?, specialization?,
  certificates?, idNumber?, bankAccount?, bankName?,
  maritalStatus?, emergencyContact?, emergencyPhone?,
  contractType?, contractEndDate?
}
```

### 3.4. Unit (Đơn vị)

```typescript
interface Unit {
  id: string;
  name: string;
  type: 'Company' | 'Branch' | 'Center' | 'BackOffice'; // ⚙️
  code: string;          // VD: DCS, BIM, HCM
  target: KPIPlan;
  lastYearActual?: KPIPlan;
  managerId?: string;
  parentId?: string;     // Org chart hierarchy
  // ... address, phone, email, description, etc.
}
```

### 3.5. KPIPlan (Chỉ tiêu KPI)

```typescript
interface KPIPlan {
  signing: number;       // Giá trị ký kết
  revenue: number;       // Doanh thu
  adminProfit: number;   // LNG quản trị (theo giá trị ký)
  revProfit: number;     // LNG theo doanh thu
  cash: number;          // Tiền về thực tế
}
```

### 3.6. Payment (Thu chi)

```typescript
interface Payment {
  id: string;
  contractId: string;
  customerId: string;
  paymentDate: string;
  dueDate: string;
  amount: number;
  paidAmount: number;
  status: 'Đã xuất HĐ' | 'Tiền về';  // ⚙️ 2-status model
  method: 'Chuyển khoản' | 'Tiền mặt' | 'LC' | 'Khác';
  paymentType: 'Revenue' | 'Expense';
  invoiceNumber?: string;
  invoiceDate?: string;
  reference?: string;
  // ...
}
```

### 3.7. Các model phụ trợ
- **Product** — Sản phẩm/Dịch vụ (code, name, category, unit, basePrice, brandId, supplierId)
- **Brand** — Thương hiệu/Hãng sản xuất
- **LineItem** — Hạng mục trong hợp đồng (quantity, inputPrice, outputPrice, VAT, foreignCurrency)
- **BusinessPlan** — PAKD (version, status, financials)
- **ContractReview** — Review/Phê duyệt
- **ContractDocument** — Tài liệu đính kèm
- **CustomerContact** — Người liên hệ khách hàng
- **ProductSupplier** — Quan hệ N:N Sản phẩm–NCC

---

## 4. Phân quyền & Bảo mật (RBAC)

### 4.1. ⚙️ Vai trò người dùng (8 roles)

| Role | Label VN | Phạm vi dữ liệu |
|------|----------|------------------|
| `Admin` | Quản trị viên | Toàn công ty + Settings |
| `Leadership` | Ban Lãnh đạo | Toàn công ty |
| `ChiefAccountant` | Kế toán trưởng | Toàn công ty |
| `Accountant` | Kế toán | Toàn công ty |
| `Legal` | Pháp chế | Toàn công ty (chỉ xem HĐ) |
| `UnitLeader` | Lãnh đạo đơn vị | Đơn vị mình |
| `AdminUnit` | Admin đơn vị | Đơn vị mình |
| `NVKD` | NV Kinh doanh | Đơn vị mình |

### 4.2. Ma trận phân quyền

> Chi tiết đầy đủ xem file `PHANQUYENHETHONG.md`

#### Contracts
- NVKD/AdminUnit/UnitLeader: View/Create/Update (đơn vị mình)
- Accountant: View/Update (chỉ trường tài chính)
- Legal: View only
- Leadership/Admin: Full CRUD

#### Payments
- NVKD/AdminUnit/UnitLeader: View + Nhập **dự kiến**
- Accountant/ChiefAccountant: View + Nhập/Sửa **thực tế**
- ChiefAccountant/Admin: Delete

### 4.3. Unit-Based Scoping
- **Global roles** (Admin, Leadership, Legal, Accountant, ChiefAccountant): Xem toàn công ty
- **Unit-scoped roles** (NVKD, AdminUnit, UnitLeader): Chỉ xem đơn vị mình
- **Cross-unit visibility**: Bảng `cross_unit_visibility` mở rộng quyền xem

### 4.4. Navigation Filtering
```
Settings      → Admin only
Units         → Admin + Leadership only
Personnel     → Admin + Leadership + ChiefAccountant + AdminUnit(HCNS)
```

---

## 5. Routing & Pages

### 5.1. ⚙️ Route Map

| Path | Component | Lazy | Mô tả |
|------|-----------|------|--------|
| `/` | Dashboard | ✅ | Tổng quan KPI |
| `/contracts` | ContractList | ✅ | Danh sách hợp đồng |
| `/contracts/new` | ContractForm | ✅ | Tạo HĐ mới |
| `/contracts/:id` | ContractDetail | ✅ | Chi tiết HĐ |
| `/contracts/:id/edit` | ContractForm | ✅ | Sửa HĐ |
| `/payments` | PaymentList | ✅ | Quản lý thu chi |
| `/analytics` | Analytics | ✅ | Thống kê chuyên sâu |
| `/documents` | DocumentManager | ✅ | Quản lý tài liệu |
| `/ai-assistant` | AIAssistant | ✅ | AI phân tích |
| `/personnel` | PersonnelList | ✅ | Danh sách nhân sự |
| `/personnel/:id` | PersonnelDetail | ✅ | Chi tiết nhân sự |
| `/customers` | CustomerList | ✅ | Danh sách KH |
| `/customers/:id` | CustomerDetail | ✅ | Chi tiết KH (CRM hub) |
| `/products` | ProductList | ✅ | Sản phẩm/DV |
| `/products/:id` | ProductDetail | ✅ | Chi tiết SP |
| `/units` | UnitList | ✅ | Đơn vị |
| `/units/:id` | UnitDetail | ✅ | Chi tiết đơn vị |
| `/settings` | Settings | ✅ | Cài đặt |
| `/user-guide` | UserGuide | ✅ | Hướng dẫn |

### 5.2. Layout (MainLayout)
- Wrap tất cả routes
- Sidebar + Header + `<Outlet />`
- Responsive: mobile sidebar overlay

---

## 6. Services Layer

### 6.1. Architecture Pattern
```
Component → Service → Supabase Client (dataClient.ts) → PostgreSQL
                    ↘ Auth Client (supabase.ts) → Auth operations
```

### 6.2. ⚙️ Danh sách Services

| Service | File | Chức năng |
|---------|------|-----------|
| ContractService | `contractService.ts` | CRUD + stats + chart data + search + batch |
| CustomerService | `customerService.ts` | CRUD + contacts sub-CRUD + search |
| PaymentService | `paymentService.ts` | CRUD + list with filters + financial stats |
| EmployeeService | `employeeService.ts` | CRUD + search + unit filter |
| UnitService | `unitService.ts` | CRUD + org chart |
| ProductService | `productService.ts` | CRUD + brand/supplier linkage |
| BrandService | `brandService.ts` | Brand CRUD |
| WorkflowService | `workflowService.ts` | PAKD approval + Contract parallel review |
| AuditLogService | `auditLogService.ts` | Audit trail logging |
| DocumentService | `documentService.ts` | File management |
| GoogleDriveService | `googleDriveService.ts` | Google Drive integration |
| PermissionService | `permissionService.ts` | RBAC permission checks |
| EmployeeTargetService | `employeeTargetService.ts` | Year-based KPI targets |
| ExecutionCostService | `ExecutionCostService.ts` | Contract execution costs |
| GeminiService | `geminiService.ts` | Gemini AI integration |
| OpenAIService | `openaiService.ts` | OpenAI integration |
| PAKDExcelParser | `pakdExcelParser.ts` | Excel import parser |
| ContextService | `contextService.ts` | App context/state |
| UnitVisibilityService | `unitVisibilityService.ts` | Cross-unit access |
| DriveInitService | `driveInitService.ts` | Google Drive folder setup |

### 6.3. Contract Service — Key Methods
- `getAll()`, `getById(id)`, `list(params)` — Phân trang + filter
- `search(term)` — Full-text search
- `getStats(params)` / `getStatsRPC(unitId, year)` — KPI statistics
- `getChartDataRPC(unitId, year)` — Monthly chart data
- `create(data)`, `update(id, data)`, `delete(id)` — With validation + retry + audit
- `batchDelete(ids)`, `exists(id)` — Batch operations
- **Retry logic**: Exponential backoff, max 3 retries
- **Validation**: Required fields check before create/update
- **Mapping**: DB snake_case ↔ Frontend camelCase auto-mapping

---

## 7. Hooks

| Hook | Chức năng |
|------|-----------|
| `usePermissions` | Check RBAC permissions (can view/create/update/delete) |
| `useContractForm` | Contract form state management |
| `useFinancialCalculations` | Auto-calculate profit, margin, etc. |
| `useLineItems` | Line items CRUD in contract form |
| `useEmployees` | Fetch employees with caching |
| `useUnits` | Fetch units with caching |
| `useUnitVisibility` | Cross-unit visibility check |
| `useInfiniteScroll` | Infinite scroll pagination |
| `useDebounce` | Input debouncing |

---

## 8. UI Component Library

### 8.1. ⚙️ Reusable Components (`components/ui/`)

| Component | Mô tả |
|-----------|--------|
| `Button` | Primary/Secondary/Ghost/Danger variants |
| `Card` | Container with header, body, footer |
| `Input` | Text input with label, error state |
| `NumberInput` | Formatted number input (VND) |
| `Modal` | Dialog overlay |
| `DataTable` | Sortable, paginated table |
| `SearchableSelect` | Dropdown with search |
| `Badge` | Status badges (color-coded) |
| `Avatar` | User avatar |
| `Breadcrumb` | Navigation breadcrumb |
| `Tooltip` | Hover tooltip |
| `ConfirmDialog` | Confirmation modal |
| `EmptyState` | Empty list placeholder |
| `ErrorState` | Error display |
| `Skeleton` / `PageSkeletons` | Loading states |
| `CommandPalette` | Ctrl+K search palette |
| `ScrollToTop` | Scroll to top button |
| `QuickAddCustomerDialog` | Inline customer creation |
| `QuickAddProductDialog` | Inline product creation |
| `QuickAddSupplierDialog` | Inline supplier creation |

---

## 9. Workflow & Approval

### 9.1. PAKD Approval Flow (Business Plan)
```
Draft → Pending_Unit → Pending_Finance → Pending_Board → Approved
                                                       → Rejected
```

### 9.2. Contract Parallel Review
```
Draft → Pending_Review → [Legal ✅ + Finance ✅] → Both_Approved → Pending_Sign → Active
                       → [Any Reject] → Draft (restart)
```

### 9.3. Workflow Components
- `ApprovalStepper` — Visual step indicator
- `ContractReviewPanel` — Review actions panel
- `ActionPanel` — Context-aware action buttons
- `SubmitLegalDialog` — Submit for legal review
- `RejectDialog` — Rejection with reason
- `ReviewLog` — Audit trail display
- `AddDocumentLinkDialog` — Attach Google Doc draft

---

## 10. Authentication

### 10.1. Flow
1. Supabase Auth (Google OAuth with `@cic.com.vn` domain)
2. Auto-match `profiles` → `employees` by email
3. Load `user_permissions` from DB
4. Set data scope based on `profiles.role` + `profiles.unit_id`

### 10.2. ⚙️ Environment Variables
```env
VITE_SUPABASE_URL=<supabase_project_url>
VITE_SUPABASE_ANON_KEY=<supabase_anon_key>
VITE_DEV_BYPASS_AUTH=true  # Dev only
```

### 10.3. Impersonation
- Admin can impersonate any role for testing
- `ImpersonationContext` provides `impersonatedUser`

---

## 11. ⚙️ Cấu trúc Tổ chức

### 11.1. Đơn vị mặc định

| ID | Code | Name | Type |
|----|------|------|------|
| `all` | ALL | Toàn công ty | Company |
| `dcs` | DCS | Trung tâm DCS | Center |
| `stc` | STC | Trung tâm STC | Center |
| `css` | CSS | Trung tâm CSS | Center |
| `bim` | BIM | Trung tâm BIM | Center |
| `pmxd` | PMXD | Trung tâm PMXD | Center |
| `tvtk` | TVTK | Trung tâm TVTK | Center |
| `tvda` | TVDA | Trung tâm TVDA | Center |
| `hcm` | HCM | Chi nhánh HCM | Branch |

### 11.2. Non-business units (⚙️ ẩn khỏi KPI)
```
HCNS — Phòng Tổng hợp (BackOffice)
TCKT — Phòng Tài chính Kế toán (BackOffice)
```

---

## 12. Database Schema (Supabase PostgreSQL)

### 12.1. Bảng chính

| Table | Mô tả | RLS |
|-------|--------|-----|
| `contracts` | Hợp đồng | App-level |
| `customers` | Khách hàng | App-level |
| `customer_contacts` | Liên hệ KH | App-level |
| `employees` | Nhân sự | App-level |
| `employee_targets` | KPI theo năm | App-level |
| `units` | Đơn vị | App-level |
| `products` | Sản phẩm/DV | App-level |
| `product_suppliers` | SP–NCC (N:N) | App-level |
| `brands` | Thương hiệu | App-level |
| `payments` | Thu chi | App-level |
| `profiles` | User profiles | App-level |
| `user_permissions` | RBAC permissions | App-level |
| `cross_unit_visibility` | Cross-unit access | App-level |
| `contract_documents` | Tài liệu HĐ | App-level |
| `business_plans` | PAKD | App-level |
| `contract_reviews` | Review/Phê duyệt | App-level |
| `audit_logs` | Nhật ký hệ thống | App-level |
| `execution_costs` | Chi phí thực hiện | App-level |
| `drive_folder_mappings` | Google Drive folders | App-level |

### 12.2. Key DB Features
- **RPC Functions**: `get_contract_stats`, `get_chart_data`, `get_customer_stats`, `get_kpi_stats`
- **Audit Triggers**: Auto-log INSERT/UPDATE/DELETE on main tables
- **Indexes**: Performance indexes on `contracts(unit_id, signed_date, status)`

---

## 13. Import/Export

### 13.1. Excel Import
- **Contracts**: Template-based import with column mapping
- **Customers**: Bulk import from Excel
- **Employees**: CSV/Excel import
- **Products**: Excel import
- **PAKD**: Specialized parser (`pakdExcelParser.ts`) + Google Sheets integration + Clipboard paste

### 13.2. Data Export
- Dashboard/Analytics data export
- PDF/print-friendly layouts

---

## 14. Key Features Summary

| # | Feature | Components | Service |
|---|---------|------------|---------|
| 1 | Dashboard KPI | `Dashboard.tsx` | ContractService.getStatsRPC |
| 2 | Contract CRUD | `ContractList/Form/Detail` | ContractService |
| 3 | Contract Form (multi-step) | `contract-form/*` | useContractForm |
| 4 | PAKD Import | `PAKDImportButton/Modal` | pakdExcelParser |
| 5 | Customer CRM | `CustomerList/Detail/Form` | CustomerService |
| 6 | Payment Tracking | `PaymentList/Form` | PaymentService |
| 7 | Analytics Charts | `Analytics.tsx` | ContractService.getChartData |
| 8 | AI Assistant | `AIAssistant.tsx` | GeminiService/OpenAIService |
| 9 | Personnel Management | `PersonnelList/Detail/Form` | EmployeeService |
| 10 | Unit Management | `UnitList/Detail/Form` | UnitService |
| 11 | KPI Targets (yearly) | `UnitSigningTab.tsx` | EmployeeTargetService |
| 12 | Product Catalog | `ProductList/Detail/Form` | ProductService |
| 13 | Approval Workflow | `workflow/*` | WorkflowService |
| 14 | Document Management | `DocumentManager.tsx` | DocumentService |
| 15 | Org Chart | `OrganizationChart.tsx` | UnitService |
| 16 | Audit Logging | Auto (triggers) | AuditLogService |
| 17 | Settings & Permissions | `Settings.tsx`, `admin/*` | PermissionService |
| 18 | User Guide | `UserGuide.tsx` | — |
| 19 | Cmd+K Palette | `CommandPalette.tsx` | — |
| 20 | Role Switcher | `RoleSwitcher.tsx` | ImpersonationContext |

---

## 15. Hướng dẫn tái tạo

### Bước 1: Khởi tạo dự án
```bash
npm create vite@latest ./ -- --template react-ts
npm install @supabase/supabase-js @tanstack/react-query react-router-dom recharts framer-motion lucide-react sonner xlsx clsx tailwind-merge date-fns react-markdown remark-gfm @google/generative-ai openai
```

### Bước 2: Cấu hình
1. Setup `vite.config.ts` với alias `@/` → root
2. Thêm Tailwind CDN + CSS variables vào `index.html`
3. Tạo `.env` với Supabase credentials
4. Cấu hình `tsconfig.json` with paths alias

### Bước 3: Tạo DB Schema
- Chạy migrations theo thứ tự trong `supabase/migrations/`
- Seed data cho units, employees

### Bước 4: Implement theo thứ tự
1. `types.ts` → Data models
2. `lib/` → Supabase client, permissions, utils
3. `contexts/` → AuthContext
4. `components/ui/` → Reusable UI library
5. `services/` → CRUD services
6. `hooks/` → Custom hooks
7. `components/` → Page components
8. `routes/` → Routing setup

---

> **⚙️ Ghi chú về CONFIG**: Mọi mục đánh dấu ⚙️ CONFIG có thể thay đổi thông qua:
> - Sửa giá trị trong `types.ts` (data models)
> - Sửa `constants.tsx` (labels, mock data, nav items)
> - Sửa CSS variables trong `index.html` (colors, fonts)
> - Sửa `.env` (backend config)
> - Sửa `PHANQUYENHETHONG.md` → `permissions.ts` (access control)
