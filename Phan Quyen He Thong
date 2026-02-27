# Tài liệu Phân quyền — Phần mềm Quản lý Hợp đồng CIC-ERP

> **Phiên bản:** 1.0 — Ngày 26/02/2026  
> **Phạm vi:** Hệ thống quản lý hợp đồng cho công ty có nhiều đơn vị trực thuộc

---

## 1. Tổng quan

Hệ thống phân quyền được thiết kế theo mô hình **RBAC kết hợp phân quyền theo đơn vị** (Role-Based Access Control + Unit-Based Scoping), đáp ứng yêu cầu:

- Công ty có **nhiều đơn vị** (trung tâm, chi nhánh, phòng ban) hoạt động **độc lập về dữ liệu hợp đồng**.
- Mỗi người dùng thuộc **một đơn vị** và chỉ thao tác trong phạm vi dữ liệu đơn vị mình, trừ khi được cấp quyền mở rộng.
- Ban lãnh đạo và phòng chức năng (Tài chính, Pháp chế) có quyền **xem và tác động xuyên đơn vị** cho mục đích quản trị và phê duyệt.

---

## 2. Cấu trúc tổ chức

### 2.1. Các loại đơn vị

| Loại | Mô tả | Ví dụ |
|------|--------|-------|
| **Company** | Cấp công ty / Ban điều hành | Toàn công ty, HĐQT, Ban Giám đốc |
| **BackOffice** | Phòng ban hỗ trợ, chức năng | Phòng Tổng hợp, Phòng TCKT |
| **Center** | Trung tâm chuyên môn (đơn vị kinh doanh) | TT BIM, TT DCS, TT TVTK, TT PMXD, TT CSS, TT TVDA, TT STC |
| **Branch** | Chi nhánh | Chi nhánh HCM |

### 2.2. Sơ đồ tổ chức

```mermaid
graph TD
    ALL["Toàn công ty"]
    HDQT["Hội đồng quản trị"]
    BGD["Ban Giám đốc"]
    
    ALL --- HDQT
    ALL --- BGD
    
    BGD --- HCNS["Phòng Tổng hợp<br/>(BackOffice)"]
    BGD --- TCKT["Phòng TCKT<br/>(BackOffice)"]
    
    BGD --- BIM["TT BIM"]
    BGD --- DCS["TT DCS"]
    BGD --- TVTK["TT TVTK"]
    BGD --- PMXD["TT PMXD"]
    BGD --- CSS["TT CSS"]
    BGD --- TVDA["TT TVDA"]
    BGD --- STC["TT STC"]
    BGD --- HCM["CN HCM<br/>(Branch)"]
```

### 2.3. Mỗi đơn vị kinh doanh có

- **Lãnh đạo đơn vị** — bao gồm **Giám đốc** và **Phó Giám đốc** đơn vị, quản lý toàn bộ hoạt động trong đơn vị
- **Nhân viên kinh doanh** — tạo và theo dõi hợp đồng
- **Admin đơn vị** — hỗ trợ vận hành, nhập liệu hợp đồng, khách hàng, theo dõi thanh toán cho đơn vị

---

## 3. Vai trò người dùng (User Roles)

Hệ thống định nghĩa 8 vai trò theo enum `user_role`:

| Vai trò | Mã | Mô tả | Phạm vi dữ liệu |
|---------|-----|--------|------------------|
| Nhân viên kinh doanh | `NVKD` | Nhập liệu hợp đồng, khách hàng, theo dõi thanh toán | Đơn vị mình |
| Admin đơn vị | `AdminUnit` | Nhập liệu hợp đồng, khách hàng, theo dõi thanh toán + quản trị vận hành đơn vị | Đơn vị mình |
| Lãnh đạo đơn vị | `UnitLeader` | Giám đốc / Phó GĐ đơn vị — xem báo cáo, quản lý nhân sự đơn vị | Đơn vị mình |
| Kế toán | `Accountant` | Quản lý thanh toán, hóa đơn, đối soát | Toàn công ty |
| Kế toán trưởng | `ChiefAccountant` | Phê duyệt tài chính, xem tổng hợp | Toàn công ty |
| Pháp chế | `Legal` | Rà soát pháp lý hợp đồng | Toàn công ty |
| Ban lãnh đạo | `Leadership` | Xem báo cáo tổng hợp, quản lý toàn công ty | Toàn công ty |
| Quản trị hệ thống | `Admin` | Toàn quyền: cài đặt, phân quyền, quản lý người dùng | Toàn công ty |

> [!IMPORTANT]
> Vai trò mặc định khi tạo tài khoản mới là **NVKD** (nhân viên kinh doanh).

### 3.1. Điều kiện đăng nhập

Để đăng nhập vào hệ thống, người dùng phải thỏa **đồng thời** 2 điều kiện:

1. **Tồn tại trong hệ thống** — đã được tạo hồ sơ nhân sự trong bảng `employees` và liên kết tài khoản (`profiles`)
2. **Email thuộc tên miền công ty** — địa chỉ email phải có dạng `*@cic.com.vn`

> [!CAUTION]
> Người ngoài công ty hoặc nhân sự chưa được tạo hồ sơ trong hệ thống sẽ **không thể đăng nhập**, kể cả khi có tài khoản Supabase Auth.

---

## 4. Mô hình phân quyền chi tiết

### 4.1. Phân quyền theo Tài nguyên — Hành động (RBAC)

Bảng `user_permissions` lưu quyền chi tiết cho từng người dùng:

| Trường | Mô tả |
|--------|--------|
| `user_id` | ID người dùng |
| `resource` | Tài nguyên (xem bảng bên dưới) |
| `actions` | Mảng hành động được phép: `view`, `create`, `update`, `delete` |

#### Danh sách tài nguyên (Resources)

| Resource | Mô tả | Ghi chú |
|----------|--------|---------|
| `contracts` | Hợp đồng | Tài nguyên chính |
| `customers` | Khách hàng / Đối tác | |
| `payments` | Thanh toán | |
| `employees` | Nhân sự | |
| `units` | Đơn vị / Phòng ban | |
| `products` | Sản phẩm / Dịch vụ | |
| `permissions` | Quản lý phân quyền | Chỉ Admin |
| `settings` | Cài đặt hệ thống | Chỉ Admin |

### 4.2. Phân quyền theo Đơn vị (Unit-Based Scoping)

Ngoài RBAC, phạm vi dữ liệu mà người dùng **nhìn thấy** được giới hạn theo đơn vị:

```mermaid
graph LR
    subgraph "Quy tắc phạm vi dữ liệu"
        A["Người dùng thuộc<br/>Đơn vị X"] --> B{"Vai trò?"}
        B -->|NVKD, AdminUnit, UnitLeader| C["Chỉ xem dữ liệu<br/>Đơn vị X"]
        B -->|Accountant, ChiefAccountant,<br/>Legal, Leadership, Admin| D["Xem dữ liệu<br/>Toàn công ty"]
        C --> E{"Có quyền<br/>cross_unit_visibility?"}
        E -->|Có| F["+ Xem thêm dữ liệu<br/>các đơn vị được cấp"]
        E -->|Không| G["Giữ nguyên<br/>chỉ đơn vị X"]
    end
```

### 4.3. Quyền xem liên đơn vị (Cross-Unit Visibility)

Bảng `cross_unit_visibility` cho phép **mở rộng phạm vi xem** cho nhân viên cụ thể:

| Trường | Mô tả |
|--------|--------|
| `employee_id` | Nhân viên được cấp quyền |
| `allowed_unit_id` | Đơn vị được phép xem thêm |
| `granted_by` | Người cấp quyền |

> [!NOTE]
> Quyền cross-unit chỉ mở rộng **quyền xem (view)**, không bao gồm quyền tạo/sửa/xóa dữ liệu của đơn vị khác.

**Ví dụ:** Nhân viên A thuộc TT BIM được cấp quyền xem dữ liệu TT DCS → Nhân viên A sẽ thấy hợp đồng của cả TT BIM và TT DCS, nhưng chỉ có thể chỉnh sửa hợp đồng của TT BIM.

---

> [!NOTE]
> **Phân hệ này chỉ quản lý hợp đồng sau khi đã ký chính thức.** Quy trình phê duyệt PAKD, dự thảo hợp đồng, v.v. thuộc phân hệ **CRM** (trước khi hợp đồng được ký).

---

## 6. Phân quyền theo chức năng

### 6.1. Tổng quan (Dashboard)

Trang Tổng quan hiển thị các chỉ số kinh doanh tổng hợp (doanh thu, số HĐ, tiến độ thanh toán…) và năng suất cá nhân.

| Nội dung | Ban điều hành | Phòng ban hỗ trợ | Đơn vị (NVKD, AdminUnit, UnitLeader) |
|----------|:---:|:---:|:---:|
| Chỉ số tổng hợp toàn công ty | ✅ | ✅ | ✅ *(chỉ số tổng, không breakdown)* |
| Chi tiết từng đơn vị | ✅ Tất cả | ✅ Tất cả | ✅ Đơn vị mình + đơn vị được cấp quyền |
| Năng suất cá nhân | ✅ Tất cả | ✅ Tất cả | ✅ Chỉ cá nhân trong đơn vị mình |

> [!NOTE]
> **Quyền xem liên đơn vị trên Dashboard:** Khi nhân viên được cấp quyền xem đơn vị khác (qua `cross_unit_visibility`), họ xem được **tổng quan đơn vị đó** (doanh số, số HĐ…) nhưng **không xem được chi tiết năng suất từng cá nhân** trong đơn vị đó.

---

### 6.2. Hợp đồng (`contracts`)

#### Phạm vi xem

| Phạm vi | NVKD | AdminUnit | UnitLeader | Kế toán | Pháp chế | BackOffice | Lãnh đạo | Admin |
|---------|:----:|:---------:|:----------:|:-------:|:--------:|:----------:|:--------:|:-----:|
| HĐ đơn vị mình | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| HĐ toàn công ty | ❌ | ❌ | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ |
| HĐ đơn vị được cấp quyền | ✅ *(chỉ xem)* | ✅ *(chỉ xem)* | ✅ *(chỉ xem)* | — | — | — | — | — |

#### Quyền thao tác

| Hành động | NVKD | AdminUnit | UnitLeader | Kế toán | Pháp chế | BackOffice | Lãnh đạo | Admin |
|-----------|:----:|:---------:|:----------:|:-------:|:--------:|:----------:|:--------:|:-----:|
| Tạo mới | ✅ *(đơn vị mình)* | ✅ *(đơn vị mình)* | ✅ *(đơn vị mình)* | ❌ | ❌ | ❌ | ✅ | ✅ |
| Chỉnh sửa | ✅ *(chỉ HĐ của mình)* | ✅ *(toàn đơn vị)* | ✅ *(toàn đơn vị)* | ❌ | ❌ | ❌ | ✅ | ✅ |
| Xóa | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ |
| Cập nhật thông tin tài chính | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ | ✅ | ✅ |

> [!IMPORTANT]
> **NVKD** chỉ được chỉnh sửa hợp đồng mà **chính mình tạo hoặc được phân công** (`employee_id`), không được sửa hợp đồng của đồng nghiệp cùng đơn vị.

#### Thao tác tài chính — Kế toán (chi tiết)

Kế toán (`Accountant`, `ChiefAccountant`) không sửa nội dung hợp đồng, nhưng được phép cập nhật các trường tài chính:

| Thao tác | Accountant | ChiefAccountant |
|----------|:----------:|:---------------:|
| Xác nhận tiền về (ghi nhận thanh toán) | ✅ | ✅ |
| Xác nhận xuất hóa đơn doanh thu | ✅ | ✅ |
| Xác nhận thu/chi đặt hàng | ✅ | ✅ |
| Cập nhật chi phí phát sinh | ✅ | ✅ |


### 6.3. Khách hàng (`customers`)

| Hành động | NVKD | AdminUnit | UnitLeader | Accountant | Legal | Leadership | Admin |
|-----------|:----:|:---------:|:----------:|:----------:|:-----:|:----------:|:-----:|
| Xem | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Tạo mới | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ✅ |
| Chỉnh sửa | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ✅ |
| Xóa | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ |

> [!NOTE]
> Dữ liệu khách hàng được **chia sẻ toàn công ty** (không phân chia theo đơn vị).

### 6.4. Thu chi & Hóa đơn (`payments`)

#### Phân loại dữ liệu tài chính

Dữ liệu tài chính trên mỗi hợp đồng được chia làm 2 loại với quyền thao tác khác nhau:

| Loại dữ liệu | Mô tả | Ví dụ |
|---------------|--------|-------|
| **Dự kiến** (Kế hoạch) | Thông tin ước tính do bộ phận kinh doanh nhập | Thời điểm tạm ứng dự kiến, thời điểm xuất doanh thu dự kiến |
| **Thực tế** (Ghi nhận) | Dữ liệu tài chính chính thức do Kế toán xác nhận | Thu tiền thực tế, chi tiền thực tế, xuất hóa đơn doanh thu |

#### Ma trận phân quyền

| Hành động | NVKD | AdminUnit | UnitLeader | Accountant | ChiefAccountant | Lãnh đạo | Admin |
|-----------|:----:|:---------:|:----------:|:----------:|:---------------:|:--------:|:-----:|
| **Xem** thu chi (đơn vị mình) | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Xem** thu chi (toàn công ty) | ❌ | ❌ | ❌ | ✅ | ✅ | ✅ | ✅ |
| **Nhập dự kiến** (tạm ứng, xuất DT) | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ✅ |
| **Thêm** thu/chi/HĐ thực tế | ❌ | ❌ | ❌ | ✅ | ✅ | ❌ | ✅ |
| **Sửa** thu/chi/HĐ thực tế | ❌ | ❌ | ❌ | ✅ | ✅ | ❌ | ✅ |
| **Xóa** thu/chi/HĐ thực tế | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ | ✅ |

> [!IMPORTANT]
> **Nguyên tắc phân tách:** Bộ phận kinh doanh (NVKD, AdminUnit, UnitLeader) chỉ nhập **kế hoạch/dự kiến**. Bộ phận Kế toán chịu trách nhiệm **ghi nhận thực tế** — đảm bảo tính chính xác và tuân thủ quy trình tài chính.

### 6.5. Nhân sự (`employees`) & Đơn vị (`units`)

| Hành động | NVKD | AdminUnit | UnitLeader | Leadership | Admin |
|-----------|:----:|:---------:|:----------:|:----------:|:-----:|
| Xem | ✅ | ✅ | ✅ | ✅ | ✅ |
| Tạo mới | ❌ | ❌ | ❌ | ❌ | ✅ |
| Chỉnh sửa | ❌ | ❌ | ✅ *(đơn vị mình)* | ❌ | ✅ |
| Xóa | ❌ | ❌ | ❌ | ❌ | ✅ |

### 6.6. Phân quyền & Cài đặt

| Hành động | Admin | Các vai trò khác |
|-----------|:-----:|:----------------:|
| Xem / Tạo / Sửa / Xóa quyền | ✅ | ❌ |
| Xem / Sửa cài đặt hệ thống | ✅ | ❌ |

### 6.7. Thống kê chuyên sâu & Truy vấn AI

Các tính năng phân tích dữ liệu nâng cao (biểu đồ chuyên sâu, truy vấn AI) được phân quyền theo phạm vi dữ liệu:

| Phạm vi truy vấn | Lãnh đạo | BackOffice | Kế toán | UnitLeader | AdminUnit | NVKD |
|-------------------|:--------:|:----------:|:-------:|:----------:|:---------:|:----:|
| Toàn công ty | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| Đơn vị mình | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Đơn vị được cấp quyền xem | ✅ | — | — | ✅ | ✅ | ✅ |

> [!NOTE]
> Lãnh đạo, BackOffice và Kế toán truy vấn **toàn công ty**. Nhân viên đơn vị truy vấn trong phạm vi **đơn vị mình + đơn vị được cấp quyền xem**.

---

## 7. Luồng dữ liệu hợp đồng xuyên đơn vị

### 7.1. Đơn vị phối hợp (Coordinating Unit)

Mỗi hợp đồng có thể liên quan đến **đơn vị phối hợp** (`coordinating_unit_id`), cho phép:
- Đơn vị phối hợp **xem** hợp đồng dù không phải đơn vị chủ trì.
- Phân bổ doanh thu/chi phí giữa các đơn vị qua `unit_allocations`.

### 7.2. Phân bổ đơn vị (Unit Allocations)

Trường `unit_allocations` (JSONB) trên hợp đồng lưu tỷ lệ phân bổ theo QĐ 09.2024:

```json
{
  "allocations": [
    { "unitId": "bim", "employeeId": "emp-001", "percentage": 60 },
    { "unitId": "dcs", "employeeId": "emp-002", "percentage": 40 }
  ]
}
```

---

## 8. Nhật ký hoạt động (Audit Log)

Mọi thao tác quan trọng đều được ghi lại trong bảng `audit_logs`:

| Trường | Mô tả |
|--------|--------|
| `user_id` | Người thực hiện |
| `table_name` | Bảng bị tác động |
| `record_id` | ID bản ghi |
| `action` | Hành động (INSERT, UPDATE, DELETE) |
| `old_data` | Dữ liệu trước thay đổi |
| `new_data` | Dữ liệu sau thay đổi |
| `comment` | Ghi chú |

> [!TIP]
> Nhật ký giúp truy vết **ai đã thay đổi gì, khi nào** — phục vụ kiểm soát nội bộ và kiểm toán.

---

## 9. Tóm tắt cơ chế bảo mật

```mermaid
graph TB
    subgraph "Tầng 1: Xác thực"
        A["Supabase Auth<br/>(Email/Password)"]
    end
    
    subgraph "Tầng 2: Vai trò"
        B["user_role<br/>(profiles.role)"]
    end
    
    subgraph "Tầng 3: Phân quyền chi tiết"
        C["user_permissions<br/>(resource + actions)"]
    end
    
    subgraph "Tầng 4: Phạm vi dữ liệu"
        D["Unit-Based Scoping<br/>(profiles.unit_id)"]
        E["Cross-Unit Visibility<br/>(cross_unit_visibility)"]
    end
    
    subgraph "Tầng 5: Kiểm toán"
        F["audit_logs"]
    end
    
    A --> B --> C --> D
    D --> E
    C --> F
```

| Tầng | Chức năng | Bảng / Cơ chế |
|------|-----------|---------------|
| 1. Xác thực | Đăng nhập, phiên làm việc | Supabase Auth (`auth.users`) |
| 2. Vai trò | Xác định nhóm quyền cơ bản | `profiles.role` (enum `user_role`) |
| 3. Phân quyền chi tiết | Quyền cụ thể trên từng tài nguyên | `user_permissions` |
| 4. Phạm vi dữ liệu | Giới hạn dữ liệu theo đơn vị | `profiles.unit_id` + `cross_unit_visibility` |
| 5. Kiểm toán | Ghi nhận mọi thay đổi | `audit_logs` |

---

## 10. Lưu ý triển khai

> [!CAUTION]
> **Row Level Security (RLS)** hiện chưa được bật trên các bảng chính (`contracts`, `profiles`, `employees`, `units`, `customers`, `payments`). Việc kiểm soát phân quyền đang được thực hiện hoàn toàn ở **tầng ứng dụng (application-level)**. Cần cân nhắc bật RLS cho các bảng chứa dữ liệu nhạy cảm để tăng cường bảo mật theo nguyên tắc defense-in-depth.

> [!WARNING]
> Khi thêm đơn vị mới hoặc thay đổi cấu trúc tổ chức, cần cập nhật lại:
> 1. Bảng `units` (thêm đơn vị)
> 2. Phân quyền `user_permissions` cho các user liên quan
> 3. Bảng `cross_unit_visibility` nếu cần quyền xem liên đơn vị
