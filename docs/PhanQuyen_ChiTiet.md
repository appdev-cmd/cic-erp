# 📋 Tài liệu Phân quyền Chi tiết — CIC ERP Contract Management

> **Phiên bản:** 2.1 — Ngày 28/02/2026  
> **Hệ thống:** CIC ERP — Phần mềm Quản lý Hợp đồng  
> **Công nghệ:** React + Supabase (PostgreSQL) + Google OAuth  
> **Tài liệu cơ sở:** PHANQUYENHETHONG.md v1.0 (26/02/2026)

---

## Mục lục

1. [Tổng quan kiến trúc phân quyền](#1-tổng-quan-kiến-trúc-phân-quyền)
2. [Tầng 1: Xác thực (Authentication)](#2-tầng-1-xác-thực-authentication)
3. [Tầng 2: Vai trò người dùng (User Roles)](#3-tầng-2-vai-trò-người-dùng-user-roles)
4. [Tầng 3: Phân quyền chi tiết RBAC (Resource-Action)](#4-tầng-3-phân-quyền-chi-tiết-rbac-resource-action)
5. [Tầng 4: Phạm vi dữ liệu (Data Scoping)](#5-tầng-4-phạm-vi-dữ-liệu-data-scoping)
6. [Tầng 5: Kiểm toán (Audit Log)](#6-tầng-5-kiểm-toán-audit-log)
7. [Ma trận phân quyền theo chức năng](#7-ma-trận-phân-quyền-theo-chức-năng)
8. [Cơ chế kỹ thuật (Technical Implementation)](#8-cơ-chế-kỹ-thuật-technical-implementation)
9. [Quy trình quản trị phân quyền](#9-quy-trình-quản-trị-phân-quyền)
10. [Phụ lục](#10-phụ-lục)

---

## 1. Tổng quan kiến trúc phân quyền

Hệ thống phân quyền CIC ERP được thiết kế theo mô hình **5 tầng bảo mật**, kết hợp RBAC (Role-Based Access Control) với phân quyền theo đơn vị (Unit-Based Scoping):

```
┌─────────────────────────────────────────────────────────────────┐
│  Tầng 1: XÁC THỰC                                              │
│  Google OAuth → Email @cic.com.vn → Employee lookup             │
├─────────────────────────────────────────────────────────────────┤
│  Tầng 2: VAI TRÒ                                               │
│  profiles.role → 9 vai trò (Admin, Leadership, UnitLeader...)   │
├─────────────────────────────────────────────────────────────────┤
│  Tầng 3: PHÂN QUYỀN CHI TIẾT (RBAC)                            │
│  user_permissions → resource × action (view/create/update/del)  │
├─────────────────────────────────────────────────────────────────┤
│  Tầng 4: PHẠM VI DỮ LIỆU                                      │
│  profiles.unit_id + cross_unit_visibility                       │
├─────────────────────────────────────────────────────────────────┤
│  Tầng 5: KIỂM TOÁN                                             │
│  audit_logs → ghi nhận mọi thay đổi                            │
└─────────────────────────────────────────────────────────────────┘
```

### Nguyên tắc thiết kế

| Nguyên tắc | Mô tả |
|------------|--------|
| **Deny-by-default** | Nếu không có quyền trong DB → từ chối. Không cấp quyền ngầm định |
| **Least privilege** | Mỗi vai trò chỉ có quyền tối thiểu cần thiết |
| **Separation of concerns** | Vai trò xác định phạm vi, DB xác định hành động cụ thể |
| **Defense-in-depth** | Nhiều tầng kiểm tra lồng nhau |

---

## 2. Tầng 1: Xác thực (Authentication)

### 2.1. Luồng xác thực

```
Người dùng
  │
  ▼
[1] Google OAuth Login (Supabase Auth)
  │
  ▼
[2] Kiểm tra email domain → phải là @cic.com.vn
  │  ❌ Từ chối + alert: "Chỉ tài khoản @cic.com.vn"
  ▼
[3] Tìm hồ sơ trong bảng profiles (theo auth user ID)
  │  ❌ Từ chối + alert: "Chưa được đăng ký trong hệ thống"
  ▼
[4] Tìm nhân viên trong bảng employees (theo email)
  │  ❌ Từ chối + alert: "Chưa có hồ sơ nhân sự"
  │  (Bỏ qua bước này nếu role = Admin)
  ▼
[5] Tự động liên kết profile ↔ employee
  │  Cập nhật: employee_id, unit_id, full_name, role
  ▼
[6] Fetch unit code từ bảng units
  ▼
[7] Set UserProfile → Cho phép truy cập hệ thống
```

### 2.2. Điều kiện đăng nhập bắt buộc

| # | Điều kiện | Cơ chế kiểm tra | Vị trí code |
|---|-----------|-----------------|-------------|
| 1 | Email thuộc `@cic.com.vn` | `email.endsWith('@cic.com.vn')` | `AuthContext.tsx:198` |
| 2 | Có profile trong hệ thống | Query `profiles` by `auth.user.id` | `AuthContext.tsx:212-216` |
| 3 | Có hồ sơ nhân sự (trừ Admin) | Query `employees` by email | `AuthContext.tsx:243-248` |

### 2.3. Token & Session

| Thành phần | Mô tả |
|------------|--------|
| **Supabase Session** | JWT token, tự động refresh |
| **Google Provider Token** | Lưu trong `sessionStorage`, dùng cho Google Sheets API |
| **Presence Channel** | Realtime tracking user online qua Supabase Presence |

---

## 3. Tầng 2: Vai trò người dùng (User Roles)

### 3.1. Danh sách 9 vai trò

| # | Vai trò | Mã (`UserRole`) | Phạm vi dữ liệu | Mô tả chức năng |
|---|---------|-----------------|-------------------|-------------------|
| 1 | Quản trị hệ thống | `Admin` | 🌐 Toàn công ty | Toàn quyền: cài đặt, phân quyền, quản lý user, CRUD tất cả |
| 2 | Ban lãnh đạo | `Leadership` | 🌐 Toàn công ty | Xem báo cáo tổng hợp, quản lý toàn công ty, CRUD dữ liệu |
| 3 | Lãnh đạo đơn vị | `UnitLeader` | 🏢 Đơn vị mình | Giám đốc/Phó GĐ đơn vị, quản lý hoạt động đơn vị |
| 4 | Admin đơn vị | `AdminUnit` | 🏢 Đơn vị mình | Hỗ trợ vận hành, nhập liệu cho đơn vị |
| 5 | Nhân viên kinh doanh | `NVKD` | 🏢 Đơn vị mình | Tạo/theo dõi hợp đồng, khách hàng của mình |
| 6 | Nhân viên kỹ thuật | `NVKT` | 🏢 Đơn vị mình | Triển khai kỹ thuật, hỗ trợ thực hiện HĐ, quản lý SP/DV |
| 7 | Kế toán trưởng | `ChiefAccountant` | 🌐 Toàn công ty | Phê duyệt, ghi nhận tài chính, toàn quyền thanh toán |
| 8 | Kế toán | `Accountant` | 🌐 Toàn công ty | Ghi nhận thanh toán thực tế, đối soát |
| 9 | Pháp chế | `Legal` | 🌐 Toàn công ty | Rà soát pháp lý hợp đồng (chỉ xem) |

### 3.2. Phân nhóm vai trò

#### Nhóm xem toàn công ty (Global View Roles)
```
Admin, Leadership, Legal, Accountant, ChiefAccountant
```
→ Xem dữ liệu tất cả đơn vị, không giới hạn phạm vi.

#### Nhóm phạm vi đơn vị (Unit-Scoped Roles)
```
NVKD, NVKT, AdminUnit, UnitLeader
```
→ Chỉ xem dữ liệu đơn vị mình + đơn vị được cấp quyền xem liên đơn vị.

### 3.3. Nguồn gốc vai trò

Vai trò được xác định theo thứ tự ưu tiên:

1. **`employees.role_code`** — Mã vai trò từ bảng nhân sự (ưu tiên cao nhất)
2. **`profiles.role`** — Vai trò lưu trong profile (fallback)

Khi đăng nhập, hệ thống tự động đồng bộ: nếu `employees.role_code` khác `profiles.role` → cập nhật `profiles.role` theo employee.

### 3.4. Vai trò mặc định

Khi tạo nhân viên mới → vai trò mặc định là **`NVKD`** (Nhân viên kinh doanh).

---

## 4. Tầng 3: Phân quyền chi tiết RBAC (Resource-Action)

### 4.1. Cấu trúc bảng `user_permissions`

```sql
CREATE TABLE user_permissions (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     TEXT NOT NULL,           -- ID người dùng (profile ID)
    resource    TEXT NOT NULL,           -- Tài nguyên (contracts, customers, ...)
    actions     TEXT[] DEFAULT '{}',     -- Mảng hành động (view, create, update, delete)
    created_at  TIMESTAMPTZ DEFAULT now(),
    updated_at  TIMESTAMPTZ DEFAULT now(),
    UNIQUE(user_id, resource)
);
```

### 4.2. Danh sách tài nguyên (Resources)

| Resource | Tên Việt | Mô tả |
|----------|----------|--------|
| `contracts` | Hợp đồng | Quản lý hợp đồng (tài nguyên chính) |
| `customers` | Khách hàng | Quản lý khách hàng/đối tác |
| `payments` | Thanh toán | Quản lý thu chi, hóa đơn |
| `employees` | Nhân sự | Quản lý hồ sơ nhân sự |
| `units` | Đơn vị | Quản lý đơn vị/phòng ban |
| `products` | Sản phẩm | Quản lý sản phẩm/dịch vụ |
| `settings` | Cài đặt | Cài đặt hệ thống |
| `permissions` | Phân quyền | Quản lý phân quyền người dùng |

### 4.3. Danh sách hành động (Actions)

| Action | Mô tả | Phạm vi |
|--------|--------|---------|
| `view` | Xem danh sách & chi tiết | Read-only |
| `create` | Tạo mới bản ghi | Write |
| `update` | Chỉnh sửa bản ghi đã có | Write |
| `delete` | Xóa bản ghi | Write (destructive) |

### 4.4. Ma trận quyền mặc định theo vai trò

#### 📄 Contracts (Hợp đồng)

| Action | Admin | Leadership | UnitLeader | AdminUnit | NVKD | NVKT | ChiefAccountant | Accountant | Legal |
|--------|:-----:|:----------:|:----------:|:---------:|:----:|:----:|:---------------:|:----------:|:-----:|
| `view` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `create` | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| `update` | ✅ | ✅ | ✅ | ✅ | ✅ ¹ | ❌ | ✅ ² | ✅ ² | ❌ |
| `delete` | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |

> ¹ NVKD chỉ sửa HĐ do mình tạo/được phân công (`salespersonId === employeeId`)  
> ² Kế toán chỉ sửa trường tài chính, không sửa nội dung hợp đồng

#### 👥 Customers (Khách hàng)

| Action | Admin | Leadership | UnitLeader | AdminUnit | NVKD | NVKT | ChiefAccountant | Accountant | Legal |
|--------|:-----:|:----------:|:----------:|:---------:|:----:|:----:|:---------------:|:----------:|:-----:|
| `view` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `create` | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ | ✅ |
| `update` | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ | ✅ |
| `delete` | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |

> Dữ liệu khách hàng chia sẻ toàn công ty, không phân chia theo đơn vị.

#### 💰 Payments (Thanh toán)

| Action | Admin | Leadership | UnitLeader | AdminUnit | NVKD | NVKT | ChiefAccountant | Accountant | Legal |
|--------|:-----:|:----------:|:----------:|:---------:|:----:|:----:|:---------------:|:----------:|:-----:|
| `view` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `create` | ✅ | ❌ | ✅ ³ | ✅ ³ | ✅ ³ | ❌ | ✅ ⁴ | ✅ ⁴ | ❌ |
| `update` | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ ⁴ | ✅ ⁴ | ❌ |
| `delete` | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ |

> ³ Bộ phận kinh doanh chỉ nhập dữ liệu **DỰ KIẾN** (kế hoạch tạm ứng, xuất DT dự kiến)  
> ⁴ Bộ phận kế toán chỉ nhập/sửa dữ liệu **THỰC TẾ** (thu tiền, chi tiền, xuất HĐ doanh thu)

**Nguyên tắc phân tách dự kiến vs thực tế:**

```
┌──────────────────────┐     ┌──────────────────────┐
│  BỘ PHẬN KINH DOANH  │     │   BỘ PHẬN KẾ TOÁN    │
│  NVKD, AdminUnit,    │     │  Accountant,          │
│  UnitLeader           │     │  ChiefAccountant      │
├──────────────────────┤     ├──────────────────────┤
│ ✅ Nhập DỰ KIẾN      │     │ ✅ Nhập THỰC TẾ       │
│ ❌ Nhập THỰC TẾ      │     │ ❌ Nhập DỰ KIẾN       │
└──────────────────────┘     └──────────────────────┘
```

#### 👤 Employees (Nhân sự)

| Action | Admin | Leadership | ChiefAccountant | HCNS AdminUnit | Các vai trò khác |
|--------|:-----:|:----------:|:---------------:|:--------------:|:----------------:|
| `view` | ✅ | ✅ | ✅ | ✅ | ❌ |
| `create` | ✅ | ✅ | ❌ | ✅ | ❌ |
| `update` | ✅ | ✅ | ❌ | ✅ | ❌ |
| `delete` | ✅ | ✅ | ❌ | ✅ | ❌ |

> HCNS AdminUnit = AdminUnit thuộc Phòng Tổng hợp (mã đơn vị `HCNS`)  
> ChiefAccountant chỉ có quyền xem nhân sự, không tạo/sửa/xóa

#### 🏢 Units (Đơn vị)

| Action | Admin | Leadership | Các vai trò khác |
|--------|:-----:|:----------:|:----------------:|
| `view` | ✅ | ✅ | ❌ |
| `create` | ✅ | ✅ | ❌ |
| `update` | ✅ | ✅ | ❌ |
| `delete` | ✅ | ✅ | ❌ |

#### 📦 Products (Sản phẩm/Dịch vụ)

| Action | Admin | Leadership | UnitLeader | AdminUnit | NVKD | NVKT | ChiefAccountant | Accountant | Legal |
|--------|:-----:|:----------:|:----------:|:---------:|:----:|:----:|:---------------:|:----------:|:-----:|
| `view` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `create` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `update` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `delete` | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |

#### ⚙️ Settings & Permissions

| Action | Admin | Các vai trò khác |
|--------|:-----:|:----------------:|
| `view` | ✅ | ❌ |
| `create` | ✅ | ❌ |
| `update` | ✅ | ❌ |
| `delete` | ✅ | ❌ |

### 4.5. Quy tắc đặc biệt cho Admin

Vai trò `Admin` có **bypass toàn bộ permission check**:

```typescript
// Trong usePermissionCheck().can():
if (role === 'Admin') return true; // Luôn cho phép
```

Quy tắc này áp dụng trước khi kiểm tra DB → Admin không cần record trong `user_permissions`.

---

## 5. Tầng 4: Phạm vi dữ liệu (Data Scoping)

### 5.1. Quy tắc phạm vi

```
┌──────────────────────────────────────────────────────────────┐
│  Người dùng đăng nhập                                        │
│  ├── profiles.role → xác định nhóm                           │
│  └── profiles.unit_id → đơn vị hiện tại                     │
│                                                              │
│  ┌─ Nhóm Global View ───────────────────────────────────┐    │
│  │ Admin, Leadership, Legal, Accountant, ChiefAccountant │    │
│  │ → Xem TẤT CẢ đơn vị (getVisibleUnitIds() = null)    │    │
│  └───────────────────────────────────────────────────────┘    │
│                                                              │
│  ┌─ Nhóm Unit-Scoped ───────────────────────────────────┐    │
│  │ NVKD, AdminUnit, UnitLeader                           │    │
│  │ → Đơn vị mình + cross_unit_visibility                 │    │
│  │   getVisibleUnitIds() = [ownUnitId, ...crossUnitIds]  │    │
│  └───────────────────────────────────────────────────────┘    │
└──────────────────────────────────────────────────────────────┘
```

### 5.2. Cross-Unit Visibility (Quyền xem liên đơn vị)

#### Cấu trúc bảng

```sql
CREATE TABLE cross_unit_visibility (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id      TEXT NOT NULL,        -- Nhân viên được cấp quyền
    allowed_unit_id  TEXT NOT NULL,        -- Đơn vị được phép xem thêm
    granted_by       TEXT,                 -- Người cấp quyền
    created_at       TIMESTAMPTZ DEFAULT now(),
    UNIQUE(employee_id, allowed_unit_id)
);
```

#### Quy tắc

| Quy tắc | Mô tả |
|---------|--------|
| Chỉ mở rộng **xem** | Cross-unit chỉ cho phép xem dữ liệu, KHÔNG cho phép tạo/sửa/xóa |
| Áp dụng cho Unit-Scoped roles | Chỉ NVKD, NVKT, AdminUnit, UnitLeader cần cross-unit |
| Admin cấp quyền | Chỉ Admin quản lý cross-unit visibility |

#### Ví dụ

```
Nhân viên A (TT BIM, NVKD)
├── Quyền mặc định: Xem HĐ của TT BIM
├── cross_unit_visibility: allowed_unit_id = "TT DCS"
└── Kết quả: Xem HĐ của TT BIM + TT DCS
    Nhưng chỉ sửa HĐ do chính mình tạo trong TT BIM
```

### 5.3. Phạm vi cụ thể theo tài nguyên

| Tài nguyên | Global roles | Unit-scoped roles |
|------------|-------------|-------------------|
| **Contracts** | Xem tất cả HĐ | Xem HĐ đơn vị mình + cross-unit |
| **Payments** | Xem tất cả thanh toán | Xem thanh toán đơn vị mình |
| **Employees** | Admin/Leadership/CA: xem tất cả | Không truy cập (trừ HCNS AdminUnit) |
| **Units** | Admin/Leadership: xem tất cả | Không truy cập |
| **Customers** | Xem tất cả | Xem tất cả (chia sẻ toàn công ty) |
| **Products** | Xem tất cả | Xem tất cả (chia sẻ toàn công ty) |
| **Dashboard** | Tổng hợp toàn công ty + chi tiết đơn vị | Tổng số toàn công ty + chi tiết đơn vị mình |

### 5.4. Quy tắc đặc biệt cho Hợp đồng

#### Quyền chỉnh sửa hợp đồng (canOnContract)

```
[1] Kiểm tra DB permission: can('contracts', 'update') → false? → TỪ CHỐI
    │
    ▼
[2] Admin hoặc Leadership? → CHO PHÉP (tất cả HĐ)
    │
    ▼
[3] Accountant hoặc ChiefAccountant? → CHO PHÉP (chỉ trường tài chính, UI hạn chế)
    │
    ▼
[4] Legal? → TỪ CHỐI (chỉ xem)
    │
    ▼
[5] HĐ khác đơn vị? → TỪ CHỐI
    │
    ▼
[6] AdminUnit hoặc UnitLeader? → CHO PHÉP (tất cả HĐ trong đơn vị)
    │
    ▼
[7] NVKD? → CHO PHÉP nếu contract.salespersonId === user.employeeId
         → TỪ CHỐI nếu HĐ của người khác
```

#### Thao tác tài chính trên hợp đồng

Chỉ các vai trò sau được sửa trường tài chính (doanh thu thực tế, hóa đơn, tiền về...):
- `Accountant`
- `ChiefAccountant`  
- `Leadership`
- `Admin`

Các vai trò kinh doanh (NVKD, AdminUnit, UnitLeader) và kỹ thuật (NVKT) **KHÔNG** được sửa trường tài chính.

---

## 6. Tầng 5: Kiểm toán (Audit Log)

### 6.1. Cấu trúc bảng `audit_logs`

| Trường | Kiểu | Mô tả |
|--------|------|--------|
| `id` | UUID | ID tự sinh |
| `user_id` | UUID | Người thực hiện |
| `table_name` | TEXT | Bảng bị tác động (contracts, employees, ...) |
| `record_id` | TEXT | ID bản ghi bị ảnh hưởng |
| `action` | TEXT | Hành động: `INSERT`, `UPDATE`, `DELETE` |
| `old_data` | JSONB | Dữ liệu trước thay đổi |
| `new_data` | JSONB | Dữ liệu sau thay đổi |
| `comment` | TEXT | Ghi chú (nếu có) |
| `created_at` | TIMESTAMPTZ | Thời điểm |

### 6.2. Trigger tự động

Audit log được ghi tự động qua PostgreSQL triggers trên các bảng chính.

---

## 7. Ma trận phân quyền theo chức năng

### 7.1. Navigation (Sidebar)

| Menu item | Admin | Leadership | UnitLeader | AdminUnit | NVKD | NVKT | ChiefAccountant | Accountant | Legal |
|-----------|:-----:|:----------:|:----------:|:---------:|:----:|:----:|:---------------:|:----------:|:-----:|
| Dashboard | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Hợp đồng | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Thanh toán | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Thống kê | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| AI Assistant | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Đơn vị | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Tài liệu | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Nhân sự | ✅ | ✅ | ❌ | ✅ ⁵ | ❌ | ❌ | ✅ | ❌ | ❌ |
| Sản phẩm | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Khách hàng | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Cài đặt | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |

> ⁵ Chỉ AdminUnit thuộc Phòng Tổng hợp (unitCode = `HCNS`)

### 7.2. Dashboard

| Nội dung | Global roles | Unit-scoped roles |
|----------|-------------|-------------------|
| KPI tổng hợp toàn công ty | ✅ Chi tiết đầy đủ | ✅ Chỉ tổng số (không breakdown đơn vị) |
| Chi tiết từng đơn vị | ✅ Tất cả đơn vị | ✅ Đơn vị mình + đơn vị được cấp quyền |
| Năng suất cá nhân | ✅ Tất cả nhân viên | ✅ Chỉ nhân viên trong đơn vị mình |

### 7.3. Hợp đồng phối hợp liên đơn vị

Mỗi hợp đồng có thể có `coordinatingUnitId` và `unitAllocations`:

```json
{
  "unitAllocations": [
    { "unitId": "bim", "employeeId": "emp-001", "percent": 60, "role": "lead" },
    { "unitId": "dcs", "employeeId": "emp-002", "percent": 40, "role": "support" }
  ]
}
```

| Vai trò trong HĐ | Quyền |
|-------------------|-------|
| Đơn vị `lead` | Có quyền chỉnh sửa HĐ (theo role thường) |
| Đơn vị `support` | Xem HĐ, tracking phần phân bổ của mình |

---

## 8. Cơ chế kỹ thuật (Technical Implementation)

### 8.1. Hook chính: `usePermissionCheck()`

**File:** `hooks/usePermissions.ts`

```typescript
const { can, canOnContract, canOnPayment, getVisibleUnitIds, role, unitId } = usePermissionCheck();
```

| Method | Mô tả | Params |
|--------|--------|--------|
| `can(resource, action)` | Kiểm tra quyền cơ bản từ DB | `('contracts', 'view')` |
| `canOnContract(action, contract?)` | Kiểm tra quyền trên HĐ cụ thể | `('update', { unitId, salespersonId })` |
| `canOnPayment(action, isPlanned)` | Kiểm tra quyền thanh toán | `('create', true)` → dự kiến |
| `getVisibleUnitIds()` | Danh sách đơn vị được xem | `null` = tất cả, `string[]` = giới hạn |

### 8.2. Luồng kiểm tra quyền

```
Component gọi can('contracts', 'update')
  │
  ▼
[1] role === 'Admin'? → return true (bypass)
  │
  ▼
[2] permissionMap.get('contracts') → Set{'view', 'create', 'update'}
  │
  ▼
[3] Set.has('update')? → return true/false
```

### 8.3. Scope helpers (lib/permissions.ts)

| Function | Mô tả |
|----------|--------|
| `canViewAllUnits(role)` | Có phải global view role? |
| `canViewEmployees(role, unitCode)` | Có được xem Nhân sự? |
| `canViewUnits(role)` | Có được xem Đơn vị? |
| `getHiddenNavItems(role, unitCode)` | Tập nav items cần ẩn |
| `canUpdateContractFinancials(role)` | Có được sửa trường tài chính HĐ? |

### 8.4. Service layer

| Service | File | Chức năng |
|---------|------|-----------|
| `PermissionService` | `services/permissionService.ts` | CRUD `user_permissions` |
| `UnitVisibilityService` | `services/unitVisibilityService.ts` | CRUD `cross_unit_visibility` |

### 8.5. Impersonation (Giả lập vai trò)

**File:** `contexts/ImpersonationContext.tsx`

Cho phép Admin giả lập vai trò người khác để test phân quyền:
- Lưu impersonated user trong `localStorage`
- `usePermissionCheck()` fetch permissions của impersonated user
- DB queries vẫn chạy với session thật (chỉ ảnh hưởng UI)

### 8.6. Cấu trúc tổ chức đơn vị

| Loại | Code ví dụ | Mô tả |
|------|-----------|--------|
| Company | — | Cấp công ty |
| BackOffice | `HCNS`, `TCKT` | Phòng ban hỗ trợ |
| Center | `BIM`, `DCS`, `TVTK`, `PMXD`, `CSS`, `TVDA`, `STC` | Trung tâm chuyên môn |
| Branch | `HCM` | Chi nhánh |

---

## 9. Quy trình quản trị phân quyền

### 9.1. Thêm nhân viên mới

```
[1] Admin tạo hồ sơ nhân sự (employees) với email @cic.com.vn
    │
    ▼
[2] Nhân viên đăng nhập Google OAuth lần đầu
    │
    ▼
[3] Hệ thống tự động:
    ├── Tạo profile trong bảng profiles
    ├── Liên kết profile ↔ employee (theo email)
    ├── Gán role từ employees.role_code
    └── Gán unit_id từ employees.unit_id
    │
    ▼
[4] DB migration seed default permissions theo role
    │
    ▼
[5] Nhân viên có thể sử dụng hệ thống với quyền mặc định
```

### 9.2. Thay đổi quyền cá nhân

```
[1] Admin vào Cài đặt → Phân quyền người dùng (PermissionManager)
    │
    ▼
[2] Chọn user → Bật/tắt từng action trên từng resource
    │
    ▼
[3] Hệ thống upsert vào user_permissions (ON CONFLICT user_id,resource)
    │
    ▼
[4] Permission cache invalidate (React Query: staleTime 10 phút)
```

### 9.3. Cấp quyền xem liên đơn vị

```
[1] Admin vào Cài đặt → Quyền xem liên đơn vị
    │
    ▼
[2] Chọn nhân viên → Tick các đơn vị được phép xem
    │
    ▼
[3] UnitVisibilityService.setForEmployee(employeeId, unitIds)
    │
    ▼
[4] Nhân viên thấy dữ liệu đơn vị bổ sung (chỉ xem, không sửa)
```

### 9.4. Thay đổi quyền mặc định role

```
[1] Admin vào Cài đặt → Mẫu phân quyền vai trò (RoleDefaultsManager)
    │
    ▼
[2] Chỉnh sửa ma trận resource × action cho từng role
    │
    ▼
[3] Nhấn "Áp dụng cho tất cả" → Ghi đè permissions cho mọi user có role đó
    │
    ▼
[4] Chỉ ảnh hưởng user hiện tại, user mới sẽ dùng DEFAULT_ROLE_PERMISSIONS
```

---

## 10. Phụ lục

### Phụ lục A: Bảng tham chiếu nhanh theo vai trò

#### 🔑 Admin — Quản trị hệ thống
- **Phạm vi:** Toàn công ty
- **Quyền:** Toàn quyền trên mọi tài nguyên, bao gồm cài đặt và phân quyền
- **Đặc biệt:** Bypass mọi permission check, quản lý cross-unit visibility

#### 👔 Leadership — Ban lãnh đạo
- **Phạm vi:** Toàn công ty
- **Quyền:** CRUD contracts/customers/products/employees/units. Payments chỉ xem
- **Đặc biệt:** Phê duyệt HĐ, xem báo cáo tổng hợp, sửa trường tài chính

#### 🏢 UnitLeader — Lãnh đạo đơn vị
- **Phạm vi:** Đơn vị mình (+ cross-unit nếu được cấp)
- **Quyền:** VCU contracts/customers/products. Payments V+C (dự kiến). Không employees/units
- **Đặc biệt:** Sửa tất cả HĐ trong đơn vị, phê duyệt PAKD cấp đơn vị

#### 📋 AdminUnit — Admin đơn vị
- **Phạm vi:** Đơn vị mình (+ cross-unit nếu được cấp)
- **Quyền:** Tương tự UnitLeader
- **Đặc biệt:** Nếu thuộc Phòng Tổng hợp (HCNS) → được truy cập module Nhân sự

#### 💼 NVKD — Nhân viên kinh doanh
- **Phạm vi:** Đơn vị mình (+ cross-unit nếu được cấp)
- **Quyền:** VCU contracts (chỉ HĐ mình)/customers/products. Payments V+C (dự kiến)
- **Đặc biệt:** Chỉ sửa HĐ do chính mình tạo/được phân công

#### 🔧 NVKT — Nhân viên kỹ thuật
- **Phạm vi:** Đơn vị mình (+ cross-unit nếu được cấp)
- **Quyền:** V contracts/customers/payments (chỉ xem). VCU products (quản lý kỹ thuật)
- **Đặc biệt:** Không có quyền tạo/sửa hợp đồng, không nhập thanh toán

#### 💰 ChiefAccountant — Kế toán trưởng
- **Phạm vi:** Toàn công ty
- **Quyền:** V+U contracts (trường tài chính). VCUD payments (toàn quyền). V employees
- **Đặc biệt:** Xóa thanh toán thực tế, phê duyệt PAKD cấp tài chính

#### 📊 Accountant — Kế toán
- **Phạm vi:** Toàn công ty
- **Quyền:** V+U contracts (trường tài chính). VCU payments (không xóa)
- **Đặc biệt:** Ghi nhận thu chi thực tế, xuất hóa đơn doanh thu

#### ⚖️ Legal — Pháp chế
- **Phạm vi:** Toàn công ty
- **Quyền:** V contracts (chỉ xem). VCU customers/products. V payments
- **Đặc biệt:** Rà soát pháp lý, không có quyền chỉnh sửa hợp đồng

### Phụ lục B: Bảng cơ sở dữ liệu liên quan

| Bảng | Mô tả | RLS |
|------|--------|-----|
| `profiles` | Thông tin user (role, unit_id, employee_id) | Dev mode |
| `user_permissions` | Quyền chi tiết (resource × actions) | Dev mode |
| `cross_unit_visibility` | Quyền xem liên đơn vị | Dev mode |
| `employees` | Hồ sơ nhân sự | Dev mode |
| `units` | Đơn vị / phòng ban | Dev mode |
| `audit_logs` | Nhật ký hoạt động | Dev mode |

### Phụ lục C: Ký hiệu viết tắt

| Ký hiệu | Ý nghĩa |
|----------|---------|
| V | View (xem) |
| C | Create (tạo) |
| U | Update (sửa) |
| D | Delete (xóa) |
| VCU | View + Create + Update |
| VCUD | View + Create + Update + Delete |
| HĐ | Hợp đồng |
| PAKD | Phương án kinh doanh |
| DT | Doanh thu |
| NCC | Nhà cung cấp |
| HCNS | Hành chính Nhân sự (Phòng Tổng hợp) |
| TCKT | Tài chính Kế toán |

---

> **Tài liệu này được tạo tự động từ source code CIC ERP và tài liệu PHANQUYENHETHONG.md v1.0.**  
> **Cập nhật lần cuối:** 28/02/2026
