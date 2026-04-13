# 💎 TÀI LIỆU CÔNG CỤ: TRỢ LÝ GIÁM ĐỐC (Trolygiamdoc_tools)

Tài liệu này cung cấp hướng dẫn chuyên sâu về mặt **kỹ thuật** của hệ thống **OpenClaw Agent** trong dự án CIC ERP. 
Mục tiêu: Giúp đội ngũ kỹ thuật và Prompt Engineer dễ dàng quản lý, bảo trì và mở rộng tính năng (Tools) cho Trợ lý AI Ban Giám Đốc.

---

## 🏗️ I. TỔNG QUAN KIẾN TRÚC & CƠ CHẾ HOẠT ĐỘNG

Thay vì để AI tự do truy cập Database (rất nguy hiểm), hệ thống OpenClaw đóng vai trò là **Trình Điều Phối (Orchestrator)** đứng giữa.

1. 🗣️ **Người dùng hỏi:** *"Tháng này có hợp đồng nào quá hạn không?"*
2. 📦 **Đóng gói dữ liệu:** Cấu trúc JSON của 28 Tools + Câu hỏi được gửi cho não bộ AI (Gemma/Qwen).
3. 🧠 **AI Gọi Hàm:** AI ngưng nói nhảm, quyết định trả về mã lệnh gọi tính năng: Gọi Tool `get_overdue_contracts`.
4. ⚙️ **Cấp quyền (OpenClaw):** Hệ thống chèn ID của User và Phân quyền (Role) vào để chặn bảo mật.
5. 🗄️ **Chạy code (NodeJS / DB):** Gửi Query xuống cơ sở dữ liệu Supabase để móc số liệu thật.
6. 🎯 **Tổng hợp & Trả Lời:** Dữ liệu thật được gửi ngược lại cho AI để AI "biên dịch" ra tiếng Việt lưu loát và in báo cáo ra màn hình.

---

## 🚀 II. HƯỚNG DẪN 4 BƯỚC ĐỂ TẠO 1 TOOL MỚI

Khi bạn code thêm tính năng mới (vd: báo cáo HRM, Tin tức...), hãy làm theo 4 quy tắc này:

### Bước 1: Định nghĩa cấu trúc (Zod Types)
Bạn cần quy định rõ ràng Tham Số đầu vào để AI không bị nhầm lẫn. Việc viết **"Description"** (Mô tả) càng kỹ, AI càng gọi Tool chính xác.

```typescript
import { z } from 'zod';
import { OpenClawTool, AgentContext } from '../../core/types';
import { supabase } from '../../utils/supabaseClient';

export const getCustomer360Tool: OpenClawTool = {
  name: "get_customer_360", // Tên gọi của Tool
  
  // 👉 Prompt Mô Tả: Rất quan trọng để "dạy" AI khi nào thì dùng tool này
  description: "Tra cứu hồ sơ tài chính 360 độ của khách hàng. KHÔNG dùng để tra cứu nhân viên.",
  
  parameters: z.object({
    keyword: z.string().describe("Tên viết tắt hoặc đầy đủ của đối tác (VD: Vingroup)."),
  }),

  // Bước 2: Viết logic lấy dữ liệu
  execute: async (args, context) => {
    // 1. Kiểm tra Quyền (Bảo mật Role-based)
    if (!context.roles.includes('DIRECTOR')) {
      return { error: "Bạn không có quyền Lãnh đạo để xem!" };
    }

    // 2. Chạy Query (Luôn giới hạn limit để tránh vỡ Server AI)
    const { data } = await supabase.from('customers')
        .select('name, total_debt').ilike('name', \`%\${args.keyword}%\`).limit(1);

    return { data: data[0] };
  }
};
```

### Bước 3: Đăng ký Tool
Mở file `registry.ts` và export Tool đó ra để hệ thống nhận diện.

### Bước 4: Tự Tối Ưu Lệnh
Nếu thấy AI lúng túng hoặc gọi sai chức năng: Hãy xem lại phần `description`.
❌ *Câu tồi:* "Tra cứu danh sách nhân sự."
✅ *Câu xịn:* "Tìm SĐT/Email của nhân sự cá nhân. KHÔNG dùng để đếm tổng số lượng nhân sự."

---

## 📊 III. CHI TIẾT DANH MỤC TOOLS & CÁC CÂU PROMPT MẪU

> *Dưới đây là danh sách phân tích các Tools quan trọng nhất. Mỗi tính năng đều đi kèm với **Câu Prompt Mẫu** để Lãnh đạo có thể Copy & Paste vào khung chat nhằm khai thác tối đa sức mạnh của AI.*

### 💼 Nhóm 1: Quản Trị Hợp Đồng & Dự Án
Giúp xem tiến độ, dòng tiền, và chặn rủi ro quá hạn của dự án.

* 🔍 **`search_contracts` (Tìm kiếm hợp đồng cơ bản)**
  * **Cơ chế:** Lọc thông tin nhanh (Limit 10 dòng)
  * **💬 Prompt Mẫu:** *"Tìm cho tôi danh sách rải rác các hợp đồng đang thực hiện trong năm 2026."*

* 📂 **`get_contract_detail` (Chi tiết 1 hợp đồng)**
  * **Cơ chế:** Trả về JSON cực lớn chứa toàn bộ lịch sử thu tiền, mốc thời gian.
  * **💬 Prompt Mẫu:** *"Cho tôi biết chi tiết tình hình tiến độ và dòng tiền của hợp đồng Viettel."*

* 📈 **`get_contract_stats` (Thống kê quy mô lớn)**
  * **Cơ chế:** Chạy hàm siêu tốc trên SQL (SUM, COUNT), không tải trọn bộ data tải về máy chủ.
  * **💬 Prompt Mẫu:** *"Thống kê nhanh tổng doanh thu và tổng số lượng hợp đồng mới quý 1/2026."*

* 🚨 **`get_overdue_contracts` (Cảnh báo rủi ro)**
  * **Cơ chế:** Quét `current_date > due_date` để giật còi báo động.
  * **💬 Prompt Mẫu:** *"Công ty hiện tại đang có hợp đồng nào đang bị quá hạn hoàn thành hoặc chậm thanh toán không?"*


### 💰 Nhóm 2: Kế Toán, Thu Chi & Công Nợ
Tập trung gỡ rối dòng tiền và rà soát hóa đơn VAT, công nợ tồn đọng.

* 🧾 **`search_payments` (Tra cứu chứng từ)**
  * **Cơ chế:** Tìm kiếm Phiếu thu, Phiếu chi, Hóa đơn VAT.
  * **💬 Prompt Mẫu:** *"Tra cứu cho tôi các phiếu thu tiền hoặc hóa đơn VAT báo có trong tháng này."*

* 💳 **`get_debt_report` (Phân tích nợ đọng)**
  * **Cơ chế:** Tính tổng tiền từ các thanh toán đang ở trạng thái 'Pending'.
  * **💬 Prompt Mẫu:** *"Xuất cho tôi báo cáo các khách hàng đang nợ đọng lâu nhất, sắp xếp nợ từ cao xuống thấp."*

* 🎯 **`get_dashboard_kpi` (Khái quát hiệu suất KPI)**
  * **Cơ chế:** Gộp số liệu từ hệ thống Dashboard gốc, xem tổng quan.
  * **💬 Prompt Mẫu:** *"Cho tôi xem bức tranh tổng quan KPI toàn công ty trong năm 2026 tới thời điểm này."*


### 🏆 Nhóm 3: CRM Phân Tích Chuyên Sâu (Dành cho Lãnh Đạo)
Đây là nhóm chức năng sở hữu trí tuệ tinh xảo nhất, kết hợp tạo Biểu đồ động (Chart.js) cực xịn.

* 🏢 **`search_customers` (Hồ sơ Đối tác 360)**
  * **Cơ chế:** Truy xuất nhanh hồ sơ khách hàng trọng điểm.
  * **💬 Prompt Mẫu:** *"Cung cấp cho tôi báo cáo toàn cảnh về đối tác công ty AIC (tổng số hợp đồng hiện có và tỷ lệ thanh toán)."*

* 📊 **`get_comparative_report` (Báo cáo Phân tích Đa Kỳ)**
  * **Cơ chế:** Tự động tính tỷ lệ Tăng/Giảm (YoY, MoM) và bắt buộc AI in kèm Block Biểu đồ.
  * **💬 Prompt Mẫu:** *"Lập báo cáo phân tích so sánh tăng trưởng doanh thu quý 1/2026 so với quý 1/2025."*

* 🏅 **`get_unit_ranking` (Bảng xếp hạng Phòng ban)**
  * **Cơ chế:** SQL sắp xếp giảm dần `ORDER BY value DESC`.
  * **💬 Prompt Mẫu:** *"Lập bảng xếp hạng doanh thu của các Phòng Ban/Trung tâm kinh doanh năm nay. Đội nào đang Top 1?"*


### 🧑‍💼 Nhóm 4: Điều Hành Mạng Lưới Nhân Sự (Tasks & HRM)
Mắt xích kết nối giữa Agent và thế giới thực (Giao việc cho nhân viên).

* 🔎 **`search_employees` (Lấy định danh ID)**
  * **Cơ chế:** Quét Tên, Email để AI xác định trúng đích Người nhận việc (Assignee).
  * **💬 Prompt Mẫu:** *"Giám đốc kinh doanh công ty là ai? Cho tôi email của Nguyễn Văn B."*

* 📋 **`create_task_ai` (Tạo Task tự động)**
  * **Cơ chế:** Bắn lệnh lên bảng Kanban của công ty (Insert DB). Bắt buộc phải tìm ID nhân viên trước khi giao.
  * **💬 Prompt Mẫu:** *"Lập ngay một biên bản thu hồi nợ giao cho kế toán Mai xử lý khẩn cấp trước ngày 15/05."*


### 📝 Nhóm 5: Tiện Ích Văn Phòng Điện Tử
Đóng gói thông tin để tương tác vật lý.

* 📥 **`export_document` (In ấn Báo cáo)**
  * **Cơ chế:** AI kết chuyển nội dung chữ sang File HTML / Docs chuyên nghiệp rồi tải lên Cloud lưu trữ.
  * **💬 Prompt Mẫu:** *"Từ các số liệu trên, xuất cho tôi bản Báo cáo thành một file HTML để tải xuống."*

* 🔔 **`send_notification_email` (Phát lệnh chuông)**
  * **Cơ chế:** Kích hoạt cảnh báo hệ thống/Mail đến cá nhân.
  * **💬 Prompt Mẫu:** *"Gửi một thông báo khẩn cấp tới @Anh Tú yêu cầu hoàn thiện danh sách báo giá."*

---

## 🧠 IV. CÁCH AI TỰ ĐỘNG NỐI CHUỖI NHIỀU TOOL (MULTI-STEP)

Sự khác biệt của AI so với phần mềm thường là bạn có thể giao một câu lệnh hàm chứa tận 3-4 kịch bản bên trong.

### 🔄 Cách AI Suy Luận (Chain-of-Thought)
**Bạn ra lệnh:** *"Kiểm tra xem đối tác AIC đang nợ bao nhiêu tiền, nếu nợ hơn 100 tỷ thì nhắc trưởng phòng kế toán Mai lập biên bản khẩn."*

**Cách AI tự hành động ngầm:**
1. **Dùng Tool 1:** Gọi `search_customers("AIC")` => Lấy ID định danh công ty AIC.
2. **Dùng Tool 2:** Gọi `get_debt_report("ID-AIC")` => Web API trả về AIC đang nợ đọng 150 tỷ.
3. **AI Dừng Lại Nhẩm Tính:** `150 tỷ > 100 tỷ` (Đúng với điều kiện Giám đốc giao). Tiếp tục!
4. **Dùng Tool 3:** Gọi `search_employees("Kế toán Mai")` => Tìm ID thẻ nhân viên của Mai.
5. **Dùng Tool 4:** Gọi `create_task_ai("Thu hồi nợ AIC", [ID_MAI])` => Chèn Task lên hệ thống Kanban.
6. **Báo cáo lại bạn:** *"Thưa sếp, AIC đang nợ 150 tỷ. Tôi đã tự động tạo Task khẩn và giao cho kế toán Mai."* => **Toàn bộ quá trình chỉ mất 3 giây!**

---

## 🚑 V. BẢNG KHẮC PHỤC SỰ CỐ (DÀNH CHO LẬP TRÌNH VIÊN)

| Hiện Tượng Lỗi | Nguyên Nhân Thực Tế | Khắc Phục Bằng Code |
| :--- | :--- | :--- |
| **Bảo mật RLS bị bỏ qua** | Quên không nhét biến `userId` từ `UserContext` vào thư viện Supabase API. | Luôn check tay: `if (!context.roles.includes('ABC')) return {error}` ở đầu hàm execute. |
| **AI bị "Đứng hình" (Lag)** | Tool SQL lỡ trả về hàng nghìn Rows thay vì Summary. Quá tải Token Context. | **MANDATORY:** Luôn dùng `.limit(10)` ở các hàm `search_`. Không Select `*` (Chỉ lấy field thiết yếu). |
| **AI "ảo giác" tự chế link** | Nhận Public URL từ Cloud rất chậm, AI tự vội vàng phỏng đoán ra 1 dãy Domain dỏm. | Cấm ở Prompt: *"Bắt buộc bạn in nguyên văn đường Link tôi trả lại, KHÔNG ĐƯỢC BỊA".* | 
| **UI Biểu đồ bị bể (<span>)** | AI tùy tiện bọc màu `<span style="color:red">` vào con số Markdown. | Chặn đứng bằng `System Prompt`: *"TUYỆT ĐỐI không dùng HTML. Chỉ dùng thuấn túy Markdown"*. |
