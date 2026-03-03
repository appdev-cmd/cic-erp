# 📖 TỪ ĐIỂN THUẬT NGỮ DỰ ÁN CIC ERP CONTRACT

> Tài liệu giúp bạn hiểu các thuật ngữ kỹ thuật trong dự án, để dễ dàng mô tả yêu cầu cho AI.
>
> **Cập nhật lần cuối:** 03/03/2026

---

## 📋 MỤC LỤC

1. [Tổng quan công nghệ](#1-tổng-quan-công-nghệ)
2. [Frontend — Giao diện người dùng](#2-frontend--giao-diện-người-dùng)
3. [Backend — Phía máy chủ](#3-backend--phía-máy-chủ)
4. [Database — Cơ sở dữ liệu](#4-database--cơ-sở-dữ-liệu)
5. [UI — Giao diện](#5-ui--giao-diện)
6. [UX — Trải nghiệm người dùng](#6-ux--trải-nghiệm-người-dùng)
7. [Các module nghiệp vụ](#7-các-module-nghiệp-vụ)
8. [Cấu trúc file dự án](#8-cấu-trúc-file-dự-án)
9. [Các thuật ngữ lập trình phổ biến](#9-các-thuật-ngữ-lập-trình-phổ-biến)
10. [Mẹo mô tả yêu cầu cho AI](#10-mẹo-mô-tả-yêu-cầu-cho-ai)

---

## 1. TỔNG QUAN CÔNG NGHỆ

| Thuật ngữ | Giải thích | Ví dụ trong dự án |
|-----------|------------|-------------------|
| **React** | Thư viện JavaScript để xây dựng giao diện. Toàn bộ giao diện ERP được viết bằng React. | `ContractList.tsx`, `Dashboard.tsx` |
| **TypeScript** | Phiên bản nâng cấp của JavaScript, có kiểm tra kiểu dữ liệu. Giúp ít lỗi hơn. | File `.ts` và `.tsx` |
| **Vite** | Công cụ chạy và build dự án. Khi gõ `npm run dev` là dùng Vite. | `vite.config.ts` |
| **Supabase** | Dịch vụ backend (máy chủ) — cung cấp Database, Auth (đăng nhập), Storage (lưu file). | `supabaseClient.ts` |
| **TailwindCSS** | Framework CSS để tạo giao diện bằng các class có sẵn thay vì viết CSS thủ công. | `className="bg-white dark:bg-slate-900"` |
| **Vercel** | Nền tảng deploy (triển khai) ứng dụng lên internet. | `vercel.json` |

---

## 2. FRONTEND — Giao diện người dùng

> **Frontend** = tất cả những gì người dùng **nhìn thấy và tương tác** trên trình duyệt.

### 2.1 Thuật ngữ cơ bản

| Thuật ngữ | Giải thích | Cách mô tả cho AI |
|-----------|------------|-------------------|
| **Component** | Một khối giao diện độc lập, có thể tái sử dụng. Mỗi file `.tsx` thường là 1 component. | *"Sửa component danh sách hợp đồng"* |
| **Page / Trang** | Một trang đầy đủ, hiển thị khi truy cập một đường dẫn. | *"Trang Dashboard"*, *"Trang chi tiết hợp đồng"* |
| **Form / Biểu mẫu** | Giao diện nhập liệu (ô input, dropdown, nút submit). | *"Form tạo hợp đồng mới"* |
| **Modal / Dialog** | Cửa sổ nhỏ bật lên (popup) để xác nhận hoặc nhập thông tin. | *"Modal xác nhận xóa"*, *"Dialog thêm khách hàng"* |
| **List / Danh sách** | Bảng hiển thị nhiều bản ghi (hợp đồng, khách hàng...). | *"Danh sách thanh toán"* |
| **Detail / Chi tiết** | Trang xem thông tin đầy đủ của 1 bản ghi. | *"Trang chi tiết sản phẩm"* |
| **Tab** | Các thẻ chuyển đổi nội dung trong cùng 1 trang. | *"Tab Phương án KD trong chi tiết hợp đồng"* |
| **Sidebar** | Thanh menu bên trái để điều hướng giữa các module. | *"Sửa sidebar, thêm mục Báo cáo"* |
| **Header** | Thanh trên cùng chứa logo, tên user, nút chuyển đơn vị. | *"Thêm nút thông báo vào header"* |
| **Breadcrumb** | Đường dẫn phân cấp phía trên nội dung (VD: Trang chủ > Hợp đồng > Chi tiết). | *"Sửa breadcrumb trang chi tiết"* |

### 2.2 Thuật ngữ nâng cao

| Thuật ngữ | Giải thích | Cách mô tả cho AI |
|-----------|------------|-------------------|
| **State / Trạng thái** | Dữ liệu thay đổi theo thời gian (VD: danh sách đã lọc, form đang nhập). | *"State filter không cập nhật khi đổi đơn vị"* |
| **Props** | Dữ liệu truyền từ component cha sang component con. | *"Truyền thêm prop `unitId` vào component"* |
| **Hook** | Hàm đặc biệt của React để tái sử dụng logic. File nằm trong thư mục `hooks/`. | *"Hook usePermissions"*, *"Hook useDebounce"* |
| **Context** | Cách chia sẻ dữ liệu toàn ứng dụng (VD: thông tin user đăng nhập). | *"AuthContext"* = thông tin đăng nhập |
| **Router / Routing** | Hệ thống điều hướng trang (URL nào hiển thị trang nào). | *"Thêm route cho trang báo cáo mới"* |
| **Lazy Loading** | Tải trang khi cần, không tải tất cả cùng lúc → nhanh hơn. | `LazyPages.tsx` |
| **Skeleton** | Khung xám hiển thị tạm khi dữ liệu đang tải. | *"Thêm skeleton cho trang danh sách"* |
| **Toast / Notification** | Thông báo nhỏ góc màn hình (thành công, lỗi). | Dùng thư viện `Sonner` |
| **Dark Mode** | Chế độ giao diện tối. Dùng class `dark:` của Tailwind. | *"Sửa dark mode cho form thanh toán"* |
| **Responsive** | Giao diện tự co giãn theo kích thước màn hình (desktop, tablet, mobile). | *"Làm responsive cho bảng"* |

---

## 3. BACKEND — Phía máy chủ

> **Backend** = xử lý logic phía server, lưu trữ dữ liệu, xác thực người dùng.

| Thuật ngữ | Giải thích | Ví dụ trong dự án |
|-----------|------------|-------------------|
| **Supabase** | Nền tảng backend dự án đang dùng (thay thế cho việc tự xây dựng server). | — |
| **API** | Giao diện lập trình — cách frontend gọi lấy dữ liệu từ backend. | `contractService.ts` gọi API Supabase |
| **Service** | File chứa logic gọi API. Mỗi module có 1 service riêng. | `paymentService.ts`, `customerService.ts` |
| **Edge Function** | Hàm chạy trên server Supabase, xử lý logic phức tạp. | `gemini-proxy` (gọi AI Gemini) |
| **Auth / Authentication** | Hệ thống đăng nhập / xác thực người dùng. | `AuthContext.tsx` |
| **RLS (Row Level Security)** | Bảo mật cấp dòng dữ liệu — ai được xem/sửa dòng nào trong DB. | Policies trên Supabase |
| **RBAC** | Phân quyền theo vai trò (Admin, NVKD, Kế toán...). | `usePermissions.ts` |
| **Migration** | File SQL thay đổi cấu trúc database (thêm bảng, cột...). | Thư mục `supabase/migrations/` |
| **Realtime** | Cập nhật dữ liệu tức thời không cần refresh trang. | Chat nội bộ dùng Supabase Realtime |
| **Webhook** | URL được gọi tự động khi có sự kiện xảy ra. | Telegram notification |

---

## 4. DATABASE — Cơ sở dữ liệu

> **Database** = nơi lưu trữ tất cả dữ liệu: hợp đồng, khách hàng, nhân viên...

### 4.1 Thuật ngữ DB

| Thuật ngữ | Giải thích | Cách mô tả cho AI |
|-----------|------------|-------------------|
| **Table / Bảng** | Một tập hợp dữ liệu cùng loại (VD: bảng `contracts`, bảng `customers`). | *"Thêm cột mới vào bảng contracts"* |
| **Column / Cột** | Một trường dữ liệu trong bảng (VD: `name`, `status`, `value`). | *"Thêm cột `invoiceDate` vào bảng payments"* |
| **Row / Dòng** | Một bản ghi dữ liệu (VD: 1 hợp đồng cụ thể). | *"Một dòng trong bảng contracts"* |
| **Primary Key (PK)** | Khóa chính — giá trị duy nhất xác định 1 bản ghi. Thường là `id`. | `id: string` (UUID) |
| **Foreign Key (FK)** | Khóa ngoại — liên kết giữa 2 bảng. | `customerId` trong bảng `contracts` trỏ đến `customers` |
| **Index** | Chỉ mục giúp truy vấn nhanh hơn. | Index trên cột `status`, `unitId` |
| **Query** | Câu lệnh truy vấn dữ liệu. | `SELECT * FROM contracts WHERE status = 'Draft'` |
| **Schema** | Cấu trúc tổng thể của database (tất cả bảng + mối liên hệ). | — |
| **JSONB** | Kiểu dữ liệu JSON trong PostgreSQL, lưu dữ liệu phức tạp. | `lineItems`, `milestones` lưu dạng JSONB |
| **UUID** | ID dạng chuỗi dài duy nhất toàn cầu. | `550e8400-e29b-41d4-a716-446655440000` |

### 4.2 Các bảng trong dự án

| Bảng | Mô tả | Liên kết với |
|------|-------|-------------|
| `contracts` | Hợp đồng | customers, units, employees |
| `customers` | Khách hàng / Nhà cung cấp | contracts, customer_contacts |
| `employees` | Nhân viên | units, user_profiles |
| `units` | Đơn vị (Chi nhánh, Trung tâm) | employees, contracts |
| `products` | Sản phẩm / Dịch vụ | brands, product_suppliers |
| `payments` | Thanh toán (Thu/Chi) | contracts, customers |
| `user_profiles` | Tài khoản người dùng | employees |
| `chat_rooms` | Phòng chat nội bộ | chat_messages, chat_members |
| `chat_messages` | Tin nhắn chat | chat_rooms |
| `business_plans` | Phương án kinh doanh | contracts |
| `contract_reviews` | Lịch sử duyệt hợp đồng | contracts |
| `brands` | Thương hiệu sản phẩm | products |
| `audit_logs` | Nhật ký thao tác | — |

---

## 5. UI — Giao diện

> **UI (User Interface)** = giao diện người dùng — những gì người dùng nhìn thấy.

### 5.1 Các UI Component dùng chung

| Component | Mô tả | Khi nào dùng |
|-----------|-------|-------------|
| **Button** | Nút bấm (Lưu, Xóa, Thêm mới...) | Mọi hành động |
| **Input** | Ô nhập text | Form nhập liệu |
| **SearchableSelect** | Dropdown có ô tìm kiếm | Chọn khách hàng, nhân viên |
| **DataTable** | Bảng dữ liệu có sắp xếp, phân trang | Danh sách HĐ, KH, SP |
| **Modal** | Popup bật lên | Xác nhận, nhập nhanh |
| **Card** | Khung chứa thông tin có border và shadow | Dashboard, chi tiết |
| **Badge** | Nhãn nhỏ hiển thị trạng thái (Nháp, Đang xử lý...) | Trạng thái HĐ, thanh toán |
| **Avatar** | Ảnh đại diện tròn | Nhân viên, user |
| **Tooltip** | Chú thích khi hover chuột | Giải thích nút, icon |
| **Skeleton** | Placeholder khi đang tải | Mọi trang |
| **EmptyState** | Hiển thị khi không có dữ liệu | Danh sách trống |
| **ConfirmDialog** | Dialog xác nhận Có/Không | Xóa, hành động nguy hiểm |
| **CommandPalette** | Thanh tìm kiếm nhanh (Ctrl+K) | Tìm HĐ, KH nhanh |
| **NumberInput** | Ô nhập số có format tự động (1,000,000) | Nhập giá trị tiền |

### 5.2 Thuật ngữ thiết kế

| Thuật ngữ | Giải thích |
|-----------|------------|
| **Layout** | Bố cục tổng thể trang (sidebar + header + nội dung chính) |
| **Padding** | Khoảng đệm bên trong (giữa nội dung và viền) |
| **Margin** | Khoảng cách bên ngoài (giữa các khối) |
| **Border** | Đường viền |
| **Shadow** | Đổ bóng tạo hiệu ứng nổi |
| **Grid** | Lưới chia cột (VD: 2 cột, 3 cột) |
| **Flex** | Cách sắp xếp phần tử theo hàng/cột linh hoạt |
| **Icon** | Biểu tượng nhỏ (dùng thư viện `Lucide React`) |
| **Animation** | Hiệu ứng chuyển động (dùng `Framer Motion`) |
| **Color Palette** | Bảng màu — dự án dùng tông xanh `indigo` + `slate` |
| **Glassmorphism** | Hiệu ứng kính mờ (backdrop blur) |

---

## 6. UX — Trải nghiệm người dùng

> **UX (User Experience)** = trải nghiệm khi sử dụng ứng dụng — có dễ dùng hay không.

| Thuật ngữ | Giải thích | Ví dụ |
|-----------|------------|-------|
| **Loading State** | Trạng thái đang tải dữ liệu | Hiển thị skeleton hoặc spinner |
| **Error State** | Trạng thái lỗi | Thông báo *"Không thể tải dữ liệu"* |
| **Empty State** | Khi không có dữ liệu nào | *"Chưa có hợp đồng nào"* + nút tạo mới |
| **Feedback** | Phản hồi cho người dùng sau hành động | Toast *"Đã lưu thành công"* |
| **Validation** | Kiểm tra dữ liệu nhập (bắt buộc, đúng format) | Tên HĐ không được để trống |
| **Navigation / Điều hướng** | Cách di chuyển giữa các trang | Sidebar, breadcrumb, nút quay lại |
| **Filter / Lọc** | Lọc dữ liệu theo điều kiện | Lọc HĐ theo trạng thái, đơn vị |
| **Search / Tìm kiếm** | Tìm kiếm dữ liệu | Tìm theo tên HĐ, mã KH |
| **Sort / Sắp xếp** | Sắp xếp cột trong bảng | Sắp xếp theo giá trị, ngày |
| **Pagination / Phân trang** | Chia dữ liệu ra nhiều trang | 20 bản ghi mỗi trang |
| **Infinite Scroll** | Tải thêm khi cuộn xuống cuối | Tin nhắn chat |
| **Debounce** | Chờ user ngừng gõ rồi mới tìm kiếm (tránh gọi API liên tục) | Ô tìm kiếm |
| **Hover Effect** | Hiệu ứng khi di chuột qua | Đổi màu nền dòng trong bảng |

---

## 7. CÁC MODULE NGHIỆP VỤ

### 7.1 Tên gọi các module

| Module | Tên tiếng Việt | Component chính | Service |
|--------|---------------|----------------|---------|
| **Contracts** | Hợp đồng | `ContractList`, `ContractForm`, `ContractDetail` | `contractService.ts` |
| **Customers** | Khách hàng | `CustomerList`, `CustomerForm`, `CustomerDetail` | `customerService.ts` |
| **Products** | Sản phẩm | `ProductList`, `ProductForm`, `ProductDetail` | `productService.ts` |
| **Personnel** | Nhân sự | `PersonnelList`, `PersonnelForm`, `PersonnelDetail` | `employeeService.ts` |
| **Payments** | Thanh toán | `PaymentList`, `PaymentForm` | `paymentService.ts` |
| **Units** | Đơn vị | `UnitList`, `UnitForm`, `UnitDetail` | `unitService.ts` |
| **Dashboard** | Tổng quan | `Dashboard.tsx` | — |
| **Chat** | Chat nội bộ | `components/chat/` | `chatService.ts` |
| **AI Assistant** | Trợ lý AI | `AIAssistant.tsx` | `geminiService.ts` |
| **Settings** | Cài đặt | `Settings.tsx`, `components/settings/` | — |
| **Workflow** | Quy trình duyệt | `components/workflow/` | `workflowService.ts` |
| **Analytics** | Phân tích | `Analytics.tsx` | — |
| **PAKD** | Phương án KD | `ImportContractModal` | `pakdService.ts` |

### 7.2 Trạng thái hợp đồng (Contract Status)

```
Draft → Pending_Review → Both_Approved → Pending_Sign → Processing → Acceptance → Liquidated → Completed
 (Nháp)   (Chờ duyệt)     (Đã duyệt)    (Chờ ký)     (Đang TH)   (Nghiệm thu)  (Thanh lý)   (Hoàn thành)
                                                           ↓
                                                       Suspended
                                                      (Tạm dừng)
```

### 7.3 Trạng thái thanh toán (Payment Status)

| Trạng thái | Ý nghĩa |
|------------|---------|
| `Tạm ứng` | Đã nhận tiền nhưng chưa xuất hóa đơn |
| `Đã xuất HĐ` | Đã xuất hóa đơn (ghi nhận doanh thu) |
| `Tiền về` | Tiền đã về tài khoản ngân hàng |

### 7.4 Vai trò người dùng (User Roles)

| Mã vai trò | Tên tiếng Việt | Quyền chính |
|------------|----------------|------------|
| `Admin` | Quản trị hệ thống | Toàn quyền |
| `Leadership` | Ban lãnh đạo | Xem + sửa tất cả, không cài đặt hệ thống |
| `UnitLeader` | Lãnh đạo đơn vị | Quản lý HĐ/KH/SP trong đơn vị |
| `AdminUnit` | Admin đơn vị | Tương tự UnitLeader |
| `NVKD` | Nhân viên kinh doanh | Tạo/sửa HĐ, KH, SP được phân công |
| `NVKT` | Nhân viên kỹ thuật | Xem HĐ, quản lý SP/DV |
| `ChiefAccountant` | Kế toán trưởng | Toàn quyền tài chính, thanh toán |
| `Accountant` | Kế toán | Nhập/sửa thanh toán |
| `Legal` | Pháp chế | Rà soát hợp đồng |

---

## 8. CẤU TRÚC FILE DỰ ÁN

```
cic-erp-contract/
├── components/           ← 🖥️ Giao diện (UI components)
│   ├── ui/               ← Components dùng chung (Button, Modal, Input...)
│   ├── chat/             ← Module chat nội bộ
│   ├── workflow/          ← Quy trình duyệt hợp đồng
│   ├── settings/          ← Trang cài đặt
│   ├── contract-form/     ← Form tạo/sửa hợp đồng
│   ├── customer-detail/   ← Chi tiết khách hàng
│   ├── ContractList.tsx   ← Danh sách hợp đồng
│   ├── Dashboard.tsx      ← Trang tổng quan
│   └── ...
├── services/             ← 🔌 Logic gọi API đến Supabase
│   ├── contractService.ts
│   ├── paymentService.ts
│   └── ...
├── hooks/                ← 🪝 Custom hooks (logic tái sử dụng)
│   ├── usePermissions.ts  ← Kiểm tra quyền
│   ├── useDebounce.ts     ← Chờ user ngừng gõ
│   └── ...
├── contexts/             ← 🌐 Dữ liệu toàn ứng dụng
│   ├── AuthContext.tsx    ← Thông tin đăng nhập
│   └── ImpersonationContext.tsx
├── types.ts              ← 📝 Định nghĩa kiểu dữ liệu
├── supabase/             ← 🗄️ Backend
│   ├── migrations/        ← SQL thay đổi cấu trúc DB
│   └── functions/         ← Edge Functions (AI, proxy...)
├── styles/               ← 🎨 CSS
├── routes/               ← 🧭 Cấu hình đường dẫn
├── lib/                  ← 📚 Thư viện tiện ích
├── utils/                ← 🔧 Hàm tiện ích
└── docs/                 ← 📄 Tài liệu
```

---

## 9. CÁC THUẬT NGỮ LẬP TRÌNH PHỔ BIẾN

| Thuật ngữ | Giải thích | Ví dụ mô tả cho AI |
|-----------|------------|-------------------|
| **Bug** | Lỗi trong phần mềm | *"Bug: bấm nút Lưu không phản hồi"* |
| **Fix** | Sửa lỗi | *"Fix lỗi dark mode ở trang thanh toán"* |
| **Feature** | Tính năng mới | *"Thêm feature xuất Excel"* |
| **Refactor** | Viết lại code cho sạch hơn, không thay đổi chức năng | *"Refactor service hợp đồng"* |
| **Deploy** | Triển khai ứng dụng lên server | *"Deploy lên Vercel"* |
| **Build** | Đóng gói ứng dụng thành bản hoàn chỉnh | `npm run build` |
| **Commit** | Lưu thay đổi code vào Git | *"Commit các file đã sửa"* |
| **Push** | Đẩy code lên GitHub | *"Push lên main"* |
| **Pull** | Kéo code mới nhất từ GitHub về | *"Pull trước khi push"* |
| **Import** | Nhập dữ liệu từ file Excel/CSV | *"Import danh sách KH từ Excel"* |
| **Export** | Xuất dữ liệu ra file | *"Export báo cáo ra PDF"* |
| **CRUD** | Create-Read-Update-Delete (Thêm-Xem-Sửa-Xóa) | *"Làm CRUD cho module mới"* |
| **Fetch** | Lấy dữ liệu từ server | *"Fetch danh sách HĐ bị chậm"* |
| **Render** | Hiển thị component lên màn hình | *"Component render lại quá nhiều lần"* |
| **Cache** | Bộ nhớ đệm để tải nhanh hơn | React Query cache dữ liệu |
| **Scope** | Phạm vi ảnh hưởng | *"Scope: chỉ sửa trang danh sách"* |
| **Merge** | Gộp code từ nhánh khác | *"Merge branch develop vào main"* |

---

## 10. MẸO MÔ TẢ YÊU CẦU CHO AI

### ✅ Cách mô tả TỐT

| Tình huống | Cách mô tả |
|------------|-----------|
| Sửa giao diện | *"Sửa **component** `PaymentList`: thêm **cột** Đơn vị, chỉnh **width** các cột"* |
| Thêm tính năng | *"Thêm **feature** xuất **Excel** cho **danh sách hợp đồng**, có lọc theo **trạng thái**"* |
| Sửa lỗi | *"**Bug** ở **form** tạo hợp đồng: khi chọn khách hàng, **dropdown** không hiển thị đúng"* |
| Sửa dark mode | *"**Dark mode** bị lỗi ở **bảng** `ContractList`: **text** không đọc được trên nền tối"* |
| Thêm cột DB | *"Thêm **cột** `note` kiểu **text** vào **bảng** `payments`, tạo **migration**"* |
| Sửa quyền | *"**Role** `Accountant` cần có quyền **delete** trên **resource** `payments`"* |

### ❌ Cách mô tả KHÔNG TỐT

| Mô tả mơ hồ | Vấn đề |
|-------------|--------|
| *"Sửa trang thanh toán"* | Sửa gì? Giao diện? Logic? Dữ liệu? |
| *"Thêm cái nút"* | Nút gì? Ở đâu? Làm gì khi bấm? |
| *"Không chạy được"* | Lỗi gì? Ở đâu? Thông báo lỗi? |

### 💡 Công thức mô tả

```
[Hành động] + [Đối tượng] + [Vị trí] + [Chi tiết]

Ví dụ:
"Thêm [nút Xuất PDF] vào [trang chi tiết hợp đồng] [góc trên bên phải, cạnh nút Sửa]"
"Sửa [dark mode] của [bảng danh sách thanh toán] [text trắng trên nền dark:bg-slate-800]"
"Thêm [cột ngày thanh toán] vào [bảng payments] [kiểu date, sau cột số tiền]"
```

---

> 💡 **Mẹo**: Khi không biết thuật ngữ chính xác, hãy **chụp màn hình** hoặc **mô tả vị trí** (*"cái ô vuông góc trên bên trái"*) — AI sẽ hiểu!
