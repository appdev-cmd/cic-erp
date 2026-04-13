# Tài Liệu Kỹ Thuật & Hướng Dẫn Phát Triển Tools - OpenClaw Agent

Tài liệu này cung cấp cái nhìn chuyên sâu về mặt **kỹ thuật** của hệ thống **OpenClaw Agent** trong dự án CIC ERP. Mục tiêu giúp Developer và Prompt Engineer hiểu rõ cơ chế nội tại để bảo trì, tùy chỉnh, chỉnh sửa lỗi, và mở rộng thêm các chức năng (Tools/Công cụ) mới cho trợ lý AI Ban Giám Đốc.

---

## I. Tổng Quan Kiến Trúc & Cơ Chế Function Calling

Hệ thống Agent tương tác với dữ liệu nền tảng dựa trên chuẩn **Tool/Function Calling**. Thay vì AI tự "bịa" ra thông tin hoặc truy cập database trực tiếp (gây mất an toàn bảo mật), nền tảng OpenClaw đứng giữa làm **Trình điều phối (Orchestrator)**. Khái niệm này còn gọi là Agentic Workflow.

### 1. Luồng Hoạt Động Kỹ Thuật (Workflow)
1. **Phân Tích Intent (Người dùng nhập liệu):** User gửi câu hỏi (Ví dụ: *"Tháng này có hợp đồng nào quá hạn không?"*).
2. **Schema Injection:** OpenClaw đóng gói câu hỏi của User + **Cấu trúc JSON mô tả 28 Tools hiện có** gửi cho não bộ Mô hình ngôn ngữ (vLLM / LiteLLM / Gemini).
3. **LLM Quyết Định Gọi Hàm (Function Routing):** AI phân tích và quyết định cần gọi tool `get_overdue_contracts`. AI ngưng trả lời chữ thông thường, thay vào đó trả về một cấu trúc JSON gọi tool (vd: `{"name": "get_overdue_contracts", "arguments": {"month": "current"}}`).
4. **Execution & Context Injection (OpenClaw):** Môi trường thực thi nhận lệnh gọi từ AI. Trước khi kích hoạt hàm chạy, OpenClaw "tiêm" vào **Context** (thông tin User id, Unit ID, Phân quyền Role/Policies).
5. **Database Transaction (Thực thi hàm):** Hàm TypeScript của Tool tương ứng được chạy. Gọi xuống Supabase, kết hợp với RLS (Row Level Security) và giới hạn quyền truy cập từ Context để tính toán/truy vấn.
6. **Data Feed & Synthesis:** OpenClaw gửi ngược kết quả (dưới dạng mảng JSON thô hoặc Markdown) cho AI bằng một message ẩn (System/Tool message). AI đọc kết quả thực tế này, dịch ra tiếng Việt thân thiện, và định dạng đẹp mắt trên UI cho User.

---

## II. Cấu Trúc Kỹ Thuật Của Một Tool (Core Interface)

Mọi Tool thiết kế cho Agent bắt buộc phải thiết kế tuân thủ chuẩn Interface `OpenClawTool`.

```typescript
import { z } from 'zod';

export interface AgentContext {
  userId: string;
  unitId: string;
  roles: string[];
  tenantId: string;
  // ... các thông tin token meta khác
}

export interface OpenClawTool {
  name: string;                           // Tên định danh (vd: get_contract_stats)
  description: string;                    // Mô tả cách AI sử dụng Tool (Prompt Engineering)
  parameters: z.ZodTypeAny;               // Định nghĩa schema tham số lấy bằng Zod Object
  execute: (args: any, context: AgentContext) => Promise<any>; // Payload logic chính
}
```

---

## III. Hướng Dẫn Nâng Cấp: Cấu Trúc, Sửa Chữa & Tạo Mới Tool (Vòng Lặp 4 Bước)

Khi bạn code thêm tính năng báo cáo mới, hoặc kết nối Agent với các module CRUD mới (như tin tức, HRM...), hãy tuân thủ 4 bước sau.

### Bước 1: Định Nghĩa Schema & Tham Số (Zod Types)
Luôn dùng viện `zod` để định nghĩa biến params. Bạn có thể chèn các prompt siêu nhỏ `.describe()` vào từng thuộc tính để "dạy" cho LLM cách ép kiểu dữ liệu từ mong muốn của hàm.

```typescript
// file mẫu: /agent/tools/crm/getCustomer360.ts

import { z } from 'zod';
import { OpenClawTool, AgentContext } from '../../core/types';
import { supabase } from '../../utils/supabaseClient';

export const getCustomer360Tool: OpenClawTool = {
  name: "get_customer_360",
  // Prompt Description (Cực kỳ quan trọng để LLM hiểu có nên gọi tool này không)
  description: "Tra cứu hồ sơ toàn cảnh (360 độ) của khách hàng/đối tác. Dùng khi User hỏi 'Sức khoẻ tài chính công ty A', 'Xem tình hình Vingroup', 'Nợ xấu của đối tác'. Không dùng để tìm danh sách nhân viên.",
  
  parameters: z.object({
    keyword: z.string().describe("Tên viết tắt hoặc đầy đủ của khách hàng (VD: Vingroup, ACB...)."),
    taxCode: z.string().optional().describe("Mã số thuế nếu User đề cập."),
  }),

  // Bước 2: Viết logic truy xuất
  execute: async (args, context) => {
    // 1. Unpack args
    const { keyword, taxCode } = args;

    // 2. Chặn quyền (Zero-Trust Security layer)
    // Hệ thống kiểm tra Role có từ hàm Context Injection
    if (!context.roles.includes('DIRECTOR') && !context.roles.includes('MANAGER')) {
      return { error: "Permission Denied: Bạn không có quyền truy cập hồ sơ 360 bảo mật." };
    }

    // 3. Truy xuất DB (Sử dụng supabase service role + RLS context if needed)
    let query = supabase.from('customers').select('id, name, total_debt, active_contracts, risk_level');
    if (keyword) query = query.ilike('name', `%${keyword}%`);
    
    // Luôn luôn limit rows để không làm tràn cửa sổ Token của LLM
    const { data, error } = await query.limit(1);

    if (error) return { error: `Database Error: ${error.message}` };
    if (!data || data.length === 0) return { message: "Không tìm thấy khách hàng nào khớp dữ liệu." };

    // 4. Return Output tinh gọn
    return {
      status: 'success',
      data: data[0]
    };
  }
};
```

### Bước 3: Đăng ký Tool Vào Registry Trung Tâm
Để OpenClaw framework gửi Tool này cho AI, bạn phải "expose" hàm qua file đăng ký hệ thống.

```typescript
// file: /agent/tools/registry.ts

import { getCustomer360Tool } from './crm/getCustomer360';
import { getContractStatsTool } from './contracts/getContractStats';
// import ...

export const agentToolsRegistry = {
  get_customer_360: getCustomer360Tool,
  get_contract_stats: getContractStatsTool,
  // ... bổ sung tools tại đây
};
```

### Bước 4: Tối Ưu Hóa & Gỡ Lỗi LLM Behavior
Nếu Tool hoạt động không chính xác (gọi nhầm, không gắp đúng biến do AI nhầm lẫn), nguyên nhân 90% là do **Mô tả (Description)** tồi.
- *Ví dụ Tồi:* `Tra cứu danh sách nhân sự.`
- *Ví dụ Tốt:* `Tìm số điện thoại, email, vị trí phòng ban của nhân sự trong công ty. LƯU Ý: Không được dùng tool này để đếm số lượng nhân sự tổng đài, nếu đếm headcount hãy dùng get_hr_headcount_stats.`

---

## IV. Danh Mục 28 Tools Hiện Hữu & Phân Tích Logic 

### Nhóm 1: Contract & Project Operation (`/tools/contracts/`)
| Tên Function | Cấu Trúc Logic Cốt Lõi | Caveats / Lưu Ý Cho Dev |
| :--- | :--- | :--- |
| `search_contracts` | Supabase `.ilike()` & `.eq()` filter cơ bản | Must `.select('id, title, value')` & `.limit(10)` để né lỗi token limit. Hàm này không xử lý tính toán tổng. |
| `get_contract_detail`| Query join với các bảng `timeline`, `terms`, `payments` | Do dữ liệu detail rất nặng, JSON payload đầu ra cần group by các keys mảng rõ ràng. |
| `get_contract_stats` | Dùng câu lệnh SQL `COUNT` & `SUM` Raw hoặc Supabase RPC | **KHÔNG** lấy toàn bộ mảng hợp đồng về Client/Node.js để tự `.reduce()` đếm tổng. |
| `get_overdue_contracts`| Query lọc dựa trên `current_date > due_date` | 
| `get_contract_expiry`| Query lọc dựa trên `end_date < current_date + {days_left}` | Nhớ cộng múi giờ việt nam (UTC+7) chuẩn trước khi query Postgres. |

### Nhóm 2: Finance, Revenue & Accounting (`/tools/finance/`)
| Tên Function | Cấu Trúc Logic Cốt Lõi | Caveats / Lưu Ý Cho Dev |
| :--- | :--- | :--- |
| `search_payments` | Lọc bảng `transactions` và `vouchers` | |
| `get_debt_report` | Supabase view / RPC tính chênh lệch Tổng thu - Tổng chi | Tính toán rủi ro cao: Yêu cầu cập nhật bảng Materialized View nếu chậm, không query RAW liên tục. |
| `get_cashflow_summary`| Phân nhóm theo bảng Cashflow Statement | |
| `get_revenue_forecast`| Truy xuất pipeline có kèm trọng số (probability) | **Dành riêng UI:** Nên định dạng payload trả về dạng `{"chartConfig": {...}}` Recharts để Browser tự render đồ thị. |
| `get_expense_breakdown`| Chạy group by theo Enum `expense_category` | Trả JSON tương tự dành cho Recharts Pie chart. |
| `get_budget_variance` | So khớp bảng `monthly_budgets` và `actual_expenditures` | Chú ý access control cấp bậc, User phòng A không được xem budget phòng B. |

### Nhóm 3 & 4: CRM, Khách Hàng, Báo Cáo C-Level (`/tools/crm/`, `/tools/analytics/`)
| Tên Function | Cấu Trúc Logic Cốt Lõi | Caveats / Lưu Ý Cho Dev |
| :--- | :--- | :--- |
| `search_customers` | Search text index cơ bản trên bảng entities | |
| `get_customer_360` | Đã xem chi tiết ví dụ trên | |
| `get_dashboard_kpi` | Gọi batch multiple RPCs, dùng `Promise.all` | Map đúng KPI dashboard hiện tại. |
| `get_comparative_report`| Logic Growth (MoM, YoY) = `(ThisPeriod - LastPeriod)/LastPeriod` | Tính toán chính xác giá trị số học tránh lỗi Zero division. |
| `get_unit_ranking` | SQL `ORDER BY value DESC LIMIT 5` | |
| `get_daily_briefing` | Scan qua hệ thống tìm các record `status = 'RED_FLAG'` | |
| `get_comprehensive_report`| Máy "in" Markdown từ hệ thống | Cố định layout Markdown ngay từ Typescript, ép LLM chỉ việc in ra để kết quả 100% chuẩn xác. |
| `get_smart_insights` | LLM đọc qua summary stats để tự tổng hợp Insight nhạy bén | |

### Nhóm 5: HR, Tasks & Quản Trị Hệ Thống (`/tools/hr/`)
| Tên Function | Cấu Trúc Logic Cốt Lõi | Caveats / Lưu Ý Cho Dev |
| :--- | :--- | :--- |
| `search_employees` | Tìm theo Tên, Email | |
| `get_hr_headcount_stats`| `COUNT(id)` group by `department` | |
| `create_task_ai` | Execute HTTP POST/ DB Insert action thông qua AI | **Bắt buộc** AI phải tìm được `assignee_id` bằng Tool search trước khi được phép ghi vào DB. (Chống Foreign Key violation). |
| `get_employee_workload`| Query đếm số Kanban Task trạng thái IN_PROGRESS từng user| |
| `approve_task` | Update record `status = 'APPROVED'` | Phải inject RLS hoặc backend kiểm tra xem Role người duyệt có khớp với `approver_id` hay không. |

### Nhóm 6: Document & Tiện Ích (`/tools/utils/`)
| Tên Function | Cấu Trúc Logic Cốt Lõi | Caveats / Lưu Ý Cho Dev |
| :--- | :--- | :--- |
| `export_document` | Backend hook gọi thư viện PDF / Exceljs rồi upload lưu Cloud | Tool trả ra Public URL, từ đó AI sẽ bảo User click dán link để tải về. |
| `send_notification_email`| Gọi API Service Gửi Mail / FCM | |
| `search_knowledge_base` | Vector Search `pgvector` trên Document | RAG thuần túy để dò hỏi luật nội bộ/chính sách. |
| `search_document_registry`| Khớp metadata (Tag, Name) | Trả về link Google Drive hay link file nội bộ. |

---

## V. Kỹ Thuật Nối Tool Nâng Cao (Chain-of-Thought / Multi-tools Orchestration)

Khi User đưa ra 1 prompt dài, phức tạp gồm nhiều điều kiện đan xen, Agent có khả năng tự động tách câu hỏi và chia chuỗi thực thi (Chain-of-Thought):

### Tình huống 1: Tuần tự nương tựa (Sequential Dependency Call)
**User Input:** *"Kiểm tra xem đối tác AIC đang nợ mình bao nhiêu tiền, nếu số dư nợ quá hạn trên 100 tỷ thì nhắc trưởng phòng kế toán lập biên bản thu hồi gấp hôm nay."*

**Luồng Phân Tín Động của LLM & OpenClaw:**
1. **Tool Gọi (Vòng 1):** `search_customers({keyword: "AIC"})` => Lấy ID Khách hàng (`cus_id = AIC-999`).
2. **Tool Gọi (Vòng 2):** `get_debt_report({customer_id: "AIC-999"})` => API Check số tiền. (Kết quả: 150 Tỷ quá hạn).
3. **Logic Suy Luận Của Mạng Nơ ron:** Do `150 > 100` đúng như flow user đề nghị, AI tiếp tục hành động.
4. **Tool Gọi (Vòng 3):** `search_employees({keyword: "Trưởng phòng kế toán"})` => Lấy user `assignee_id`.
5. **Tool Gọi (Vòng 4):** `create_task_ai({title: "Lập biên bản thu hồi nợ AIC KHẨN", assignee_id: "UID-88", deadline: "hôm nay"})`.
6. **Màn Hình Dừng (Final Response):** LLM gom tất lại và báo trên UI: *"Tôi đã check. Công ty AIC đang nợ quá hạn 150 Tỷ đồng. Tôi vừa tự động tạo một nhiệm vụ khẩn cấp giao cho chị Hương (Trưởng kế toán) để lập biên bản thu hồi trong hôm nay."*

**Lưu ý cho Developer:** Bạn KHÔNG cần phải tự code hard code flow logic này (`if a() then b()`). Sức mạnh của OpenClaw là nó đọc hiểu Description và Zod schema của 28 tools ở trên rồi để Engine tự thiết kế luồng xử lý cực thông minh. Việc của bạn là viết Tool thật RÕ RÀNG.

### Tình huống 2: Gọi Hàm Đa Tuyến (Parallel Execution)
**User Input:** *"Hãy mang ra số tổng chi quý 1 và danh sách HĐ chi nhánh Đà Nẵng ra đây cho anh."*
- Engine AI nhận diện yêu cầu hoàn toàn độc lập với nhau.
- Nó trả về mảng calls gồm 2 object Tool 1 lượt: `[get_cashflow_summary(...), search_contracts(...)]`.
- OpenClaw chạy `Promise.all` song song ở Backend Nodejs để đạt hiệu năng Nhanh x2.

---

## VI. Bảng Gỡ Lỗi & Xử Lý Sự Cố Khi Viết Tool Mới

| Triệu chứng Error | Nguyên nhân phổ biến | Cách Khắc Phục Code |
| :--- | :--- | :--- |
| **"Error parsing arguments" / JSON Error** | LLM xuất JSON gọi tool bị vỡ ngoặc, hoặc thiếu tham số bắt buộc. | Mở schema Zod, dùng `.optional()` cho các tham số rủi ro cao. Khuyến khích tham số dạng Enum `.enum(['YES', 'NO'])` thay vì cho `string()` chạy dài. |
| **Bảo mật RLS bị vượt qua (Lỗ hổng)** | Viết query không dùng instance Supabase kèm jwt của context hiện tại (Role bypass). | Đảm bảo context `userId` được insert làm Postgres JWT / Header trước mỗi Query. Hoặc manual check condition `roles.includes(...)` ở đầu hàm execute. |
| **Token Limit Reached (Tràn Context)** | Trả về 1000 records từ `search_` do quên clamp dữ liệu. Dữ liệu nhét vào não AI làm treo xử lý. | Luôn chốt `.limit(10)` hoặc `.limit(20)`. Phân trang nếu báo cáo quá xịn. Cắt tỉa: chỉ serialize các columns quan trọng `(id, title, value)`. `NO` `created_at, updated_at, image_url` |
| **AI báo ("Tôi không tìm thấy tool phù hợp")** | Tool mô tả qua loa, sai từ khoá, AI không thể matching Intent. | Thay từ "Tìm hoá đơn" thành "Công cụ tìm kiếm chứng từ kế toán, chứng từ thanh toán, uỷ nhiệm chi, hoá đơn (invoice)." |
