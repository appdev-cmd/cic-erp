# 💎 Tài Liệu Hệ Thống & Hướng Dẫn Phát Triển: Trợ Lý Giám Đốc (Trolygiamdoc_tools)

Tài liệu này cung cấp cái nhìn chuyên sâu về mặt **kỹ thuật** của hệ thống **OpenClaw Agent** trong dự án CIC ERP. Mục tiêu giúp Developer và Prompt Engineer hiểu rõ cơ chế nội tại để bảo trì, tùy chỉnh, sửa lỗi, và mở rộng thêm các chức năng (Tools/Công cụ) mới cho Trợ lý AI Ban Giám Đốc.

---

## 🏗️ I. Tổng Quan Kiến Trúc & Cơ Chế Function Calling

Hệ thống Agent tương tác với dữ liệu nền tảng dựa trên chuẩn **Tool/Function Calling**. Thay vì AI tự "bịa" ra thông tin hoặc truy cập database trực tiếp (gây mất an toàn bảo mật), nền tảng OpenClaw đứng giữa làm **Trình điều phối (Orchestrator)**. Khái niệm này còn gọi là Agentic Workflow.

### Luồng Hoạt Động Kỹ Thuật (Workflow)
1. 🗣️ **Phân Tích Intent (Người dùng nhập liệu):** User gửi câu hỏi (Ví dụ: *"Tháng này có hợp đồng nào quá hạn không?"*).
2. 📦 **Schema Injection:** OpenClaw đóng gói câu hỏi của User + **Cấu trúc JSON mô tả 28 Tools hiện có** gửi cho não bộ Mô hình ngôn ngữ (vLLM / LiteLLM / Gemini).
3. 🧠 **LLM Quyết Định Gọi Hàm (Function Routing):** AI phân tích và quyết định cần gọi tool `get_overdue_contracts`. AI ngưng trả lời chữ thông thường, thay vào đó trả về một cấu trúc JSON gọi tool (vd: `{"name": "get_overdue_contracts", "arguments": {"type": "all"}}`).
4. ⚙️ **Execution & Context Injection (OpenClaw):** Môi trường thực thi nhận lệnh gọi từ AI. Trước khi kích hoạt hàm chạy, OpenClaw tự động "tiêm" vào **Context** (thông tin User ID, Unit ID, Phân quyền Role/Policies).
5. 🗄️ **Database Transaction (Thực thi hàm):** Hàm TypeScript của Tool tương ứng được chạy. Gọi xuống Supabase, kết hợp với RLS (Row Level Security) và giới hạn quyền truy cập từ Context để tính toán/truy vấn.
6. 🎯 **Data Feed & Synthesis:** OpenClaw gửi ngược kết quả (dưới dạng mảng JSON thô hoặc Markdown) cho AI. AI đọc kết quả thực tế này, biên dịch ra tiếng Việt thân thiện, và định dạng đẹp mắt trên UI cho User.

---

## 🛠️ II. Cấu Trúc Kỹ Thuật Của Một Tool (Core Interface)

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

## 🚀 III. Hướng Dẫn Phát Triển: 4 Bước Thêm Tool Mới

Khi bạn code thêm tính năng báo cáo mới, hoặc kết nối Agent với các module CRUD mới (như tin tức, HRM...), hãy tuân thủ 4 bước sau.

### Bước 1: Định Nghĩa Schema & Tham Số (Zod Types)
Luôn dùng thư viện `zod` để định nghĩa biến params. Bạn có thể chèn các prompt siêu nhỏ `.describe()` vào từng thuộc tính để "dạy" cho LLM cách ép kiểu dữ liệu từ mong muốn của hàm.

```typescript
// file mẫu: /agent/tools/crm/getCustomer360.ts

import { z } from 'zod';
import { OpenClawTool, AgentContext } from '../../core/types';
import { supabase } from '../../utils/supabaseClient';

export const getCustomer360Tool: OpenClawTool = {
  name: "get_customer_360",
  // Prompt Description (Cực kỳ quan trọng để LLM hiểu có nên gọi tool này không)
  description: "Tra cứu hồ sơ toàn cảnh (360 độ) của khách hàng/đối tác. Dùng khi User hỏi 'Sức khoẻ tài chính công ty A', 'Xem tình hình doanh nghiệp'. Không dùng để tìm nhân viên.",
  
  parameters: z.object({
    keyword: z.string().describe("Tên viết tắt hoặc đầy đủ của khách hàng (VD: Vingroup, ACB...)."),
  }),

  // Bước 2: Viết logic truy xuất
  execute: async (args, context) => {
    // 1. Unpack args
    const { keyword } = args;

    // 2. Chặn quyền (Zero-Trust Security layer)
    if (!context.roles.includes('DIRECTOR') && !context.roles.includes('MANAGER')) {
      return { error: "Permission Denied: Bạn không có quyền truy cập hồ sơ 360 bảo mật." };
    }

    // 3. Truy xuất DB (Limit records để tránh tràn token)
    let query = supabase.from('customers').select('id, name, total_debt').ilike('name', \`%\${keyword}%\`).limit(1);
    const { data, error } = await query;

    if (error) return { error: \`Database Error: \${error.message}\` };
    if (!data || data.length === 0) return { message: "Không tìm thấy dữ liệu." };

    // 4. Return Output tinh gọn
    return { status: 'success', data: data[0] };
  }
};
```

### Bước 3: Đăng ký Tool Vào Registry Trung Tâm
Để framework gửi Tool này cho AI, bạn phải expose hàm qua file `registry.ts`.

### Bước 4: Tối Ưu Hóa & Gỡ Lỗi
Nếu AI gọi nhầm Tool, **90% là do Mô tả (Description) tồi**.
- ❌ *Ví dụ Tồi:* `Tra cứu danh sách nhân sự.`
- ✅ *Ví dụ Tốt:* `Tìm Tên/SĐT/Email của nhân sự. KHÔNG dùng để đếm tổng số lượng nhân sự, nếu đếm hãy dùng get_hr_headcount_stats.`

---

## 📊 IV. Danh Mục Tools Hiện Hữu & Ví Dụ Prompt Phân Tích

Dưới đây là danh sách phân loại các Tool đã thực thi vào nền tảng. Bạn có thể sử dụng các "Ví dụ Prompt" tương ứng để nhập vào khung chat kiểm thử (Test) độ nhạy của AI trong việc gọi và truyền tham số cho hàm.

### 💼 Nhóm 1: Hợp Đồng & Dự Án (Contract Operations)
> Xử lý tìm kiếm, tra cứu trạng thái, thời hạn, và tổng quan hợp đồng ký kết.

| Tên Function | Chức Năng Cốt Lõi & Lưu ý | 💡 Ví Dụ Prompt (Test AI) |
| :--- | :--- | :--- |
| `search_contracts` | Supabase `.ilike()`. Cần `.limit(10)`. Dùng tìm kiếm tóm tắt nhanh. | *"Tìm cho tôi danh sách các hợp đồng năm 2026."* |
| `get_contract_detail`| Query join (timeline, terms...). JSON trả về cực kỳ chi tiết. | *"Mở chi tiết hợp đồng thi công nội thất của đối tác Viettel xem tiến độ."* |
| `get_contract_stats` | Chạy RPC SQL `COUNT` & `SUM`. Không lấy fetch toàn mảng về node. | *"Thống kê tổng số lượng hợp đồng và tổng giá trị ký mới của quý 1 ra sao?"* |
| `get_overdue_contracts`| Lọc theo `current_date > due_date` và `status`. | *"Công ty hiện tại đang có hợp đồng nào quá hạn hoàn thành hay quá hạn thanh toán không?"* |

### 💰 Nhóm 2: Tài Chính, Kế Toán & Doanh Thu (Finance)
> Tính toán dòng tiền, thanh toán VAT, công nợ, ngân sách phòng ban.

| Tên Function | Chức Năng Cốt Lõi & Lưu ý | 💡 Ví Dụ Prompt (Test AI) |
| :--- | :--- | :--- |
| `search_payments` | Lọc bảng `transactions` & `vouchers`. | *"Tìm các phiếu thu tiền hoặc hóa đơn VAT báo có tháng này."* |
| `get_debt_report` | Supabase RPC tính tổng nợ từ các payments Pending. | *"Báo cáo cho tôi danh sách các khách hàng đang nợ đọng, sắp xếp khoản nợ từ cao xuống thấp."* |
| `get_dashboard_kpi`| Fetch RPC Dashboard tổng quản lợi nhuận QT và KPIs. | *"Tổng quan bức tranh KPI năm 2026 của toàn công ty tới nay đạt bao nhiêu?"* |

### 📈 Nhóm 3: CRM, Báo Cáo Phân Tích & C-Level Analytics
> Nhóm quan trọng nhất, hỗ trợ Lãnh Đạo ra quyết định dựa vào số liệu Growth % và Insight.

| Tên Function | Chức Năng Cốt Lõi & Lưu ý | 💡 Ví Dụ Prompt (Test AI) |
| :--- | :--- | :--- |
| `search_customers` | Truy vấn entity khách hàng và nhà cung cấp. | *"Báo cáo sơ bộ về đối tác AIC (tổng hợp đồng và thông tin cơ bản)."* |
| `get_comparative_report`| Tính YoY, MoM Growth %. Kèm Block biểu đồ động ` ```chart ` | *"Phân tích so sánh kết quả kinh doanh quý 1 năm nay so với quý 1 năm ngoái. Đánh giá sự tăng trưởng."* |
| `get_unit_ranking` | SQL `ORDER BY value DESC LIMIT 5` đánh giá phòng ban. | *"Phòng ban hay đơn vị nào đang có doanh thu cao nhất năm nay? Hãy xếp hạng hiệu suất."* |

### 🧑‍💼 Nhóm 4: Nhân Sự, Tuyển Dụng & Công Việc (HRM)
> Liên kết mô-đun Tasks (Kanban) và nhân sự điều hành.

| Tên Function | Chức Năng Cốt Lõi & Lưu ý | 💡 Ví Dụ Prompt (Test AI) |
| :--- | :--- | :--- |
| `search_employees` | Hỗ trợ tìm `assignee_id` bằng lệnh ilike email/name. | *"Giám đốc kinh doanh công ty là ai? Cho tôi email của Nguyễn Văn A."* |
| `create_task_ai` | Bắn lệnh POST/Insert vào entity Tasks board. | *"Lập ngay một biên bản thu hồi nợ giao cho kế toán Mai xử lý khẩn cấp trước ngày mốt."* |

### 📝 Nhóm 5: Tiện Ích Hành Chính & Lập Văn Bản
> Nhóm tính năng nâng cao liên kết xuất báo cáo và thông báo tức thời.

| Tên Function | Chức Năng Cốt Lõi & Lưu ý | 💡 Ví Dụ Prompt (Test AI) |
| :--- | :--- | :--- |
| `export_document` | Chuyển đổi Markdown AI → PDF/Word HTML. Tải lên Supabase Storage và cấp thẻ tải. | *"Lập báo cáo tổng kết kinh doanh hôm nay và **xuất file HTML tải xuống** cho tôi."* |
| `send_notification_email`| Gọi API Service thông báo Notification chuông và Mail. | *"Gửi một thông báo khẩn cấp tới @Anh Tú yêu cầu hoàn thiện KPIs tháng này."* |

---

## 🧠 V. Kỹ Thuật Nối Tool Nâng Cao (Chain-of-Thought / Multi-tools Orchestration)

Khi User đưa ra 1 prompt dài phức tạp gồm nhiều điều kiện đan xen, Agent có khả năng tự động tách câu hỏi và chia chuỗi thực thi (Chain-of-Thought):

### 🔄 Tình huống 1: Tuần tự suy luận (Sequential Dependency Call)
**User Input:** *"Kiểm tra xem đối tác AIC đang nợ mình bao nhiêu tiền, nếu số dư nợ quá hạn trên 100 tỷ thì nhắc trưởng phòng kế toán lập nhiệm vụ thu hồi ngay."*

**Luồng Phân Tích Của Mạng Nơ ron:**
1. **Tool Gọi (Vòng 1):** `search_customers({search: "AIC"})` => Lấy định danh Khách hàng.
2. **Tool Gọi (Vòng 2):** `get_debt_report({customer_id: "ID-AIC"})` => API Check số tiền.
3. **Logic Suy Luận Trung Gian:** LLM nhẩm (số nợ đang là 150 tỷ -> thỏa mãn > 100). Tiếp tục chạy.
4. **Tool Gọi (Vòng 3):** `search_employees({searchName: "Trưởng phòng kế toán"})` => Lấy ID nhân viên.
5. **Tool Gọi (Vòng 4):** `create_task_ai({title: "Thu hồi nợ AIC KHẨN", assigneeIds: ["EMP-02"]})`.
6. **Final Output:** *"Tôi đã truy xuất: AIC nợ quá hạn 150 tỷ. Tôi vừa tạo một nhiệm vụ khẩn cấp giao chị Hương kế toán..."*

### ⚡ Tình huống 2: Gọi Hàm Đa Tuyến (Parallel Execution)
**User Input:** *"Mang cho tôi thống kê tổng doanh thu toàn cty, đồng thời xuất danh sách hợp đồng bị quá hạn ra đây."*
- Engine AI nhận diện hai vế của câu hỏi độc lập nhau.
- Nó trả về Array Tool Calls cùng 1 lúc: `[get_contract_stats(), get_overdue_contracts()]`.
- OpenClaw chạy `Promise.all` song song 2 request backend, nhận kết quả siêu nhanh.

---

## 🛠️ VI. Bảng Rủi Ro & Gỡ Lỗi Thường Gặp (Troubleshooting)

| Triệu chứng Error | Nguyên nhân phổ biến | Cách Khắc Phục Code |
| :--- | :--- | :--- |
| **"Error parsing arguments"** | LLM xuất JSON bị vỡ, do nhét cả thẻ Markdown/HTML `\n` vào Schema string. | Bật bộ vệ sinh (Regex) ở `gateway.ts` để `escape(\n)` trước khi parse JSON. Dùng `.optional()` ở Zod. |
| **Bảo mật RLS Bị Bỏ Qua** | Quên không nhét `userId` từ `UserContext` vào API Supabase. | Luôn bọc hàm execution bên trong block `if (!context.roles.includes(...)) return {error: "..."}`. |
| **Tràn Context Window** | Tool trả về hàng nghìn Record thay vì chỉ 10 dòng đầu. | Phải luôn chốt lệnh SQL bằng `.limit(10)`. Tuyệt đối không Select `*`, chỉ `.select('id, name')`. |
| **AI "ảo giác" tự chế link**| AI xào nấu lại Public Url (File Download). | Tại Description Export Tool, ghi rõ: *"Bắt buộc bạn in nguyên văn đường Link tôi trả lại, KHÔNG ĐƯỢC BỊA".* | 
| **Markdown / Biểu Đồ bị bể**| LLM tuỳ tiện thêm thẻ Element `<span>`, `<div>` vào Text report. | Dùng `System Prompt` tát thẳng mặt: *"Cấm dùng thẻ HTML. Bắt buộc Copy-Paste block ` ```chart ` nguyên vẹn 100%".* | 
