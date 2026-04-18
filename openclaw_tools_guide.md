# Hướng Dẫn Sử Dụng & Phát Triển Tools - OpenClaw Agent

Tài liệu này cung cấp hướng dẫn toàn diện, chi tiết về **toàn bộ 28 Tools (công cụ)** của **Agent Trợ lý Ban Giám đốc (OpenClaw)** trong dự án CIC ERP Contract. Tài liệu được thiết kế làm "kim chỉ nam" cho Developer khi bảo trì, nâng cấp, và đào tạo (Prompt Engineering) cho hệ thống AI Agent.

---

## I. Cơ Chế Hoạt Động (Vai Trò Của OpenClaw Framework)

Hệ thống Agent vận hành theo cơ chế Function Calling qua framework nội bộ OpenClaw:

1. **Phân tích Ý định (Intent Recognition):** LLM phân tích câu hỏi của User, dựa trên bộ `description` của 28 Tools để quyết định dùng Tool nào.
2. **Kích hoạt Tool (Function Calling):** LLM trả về lệnh JSON chứa tham số (vd: `{"year": "2026"}`). OpenClaw parse chuỗi JSON này và tìm Tool trong `registry.ts`.
3. **Thực thi & Bảo mật (Execution & Zero-trust):** OpenClaw (đóng vai trò Orchestrator) tự động inject thông tin User (Unit ID, Permissions) vào Tool. Backend query DB (Supabase) có kiểm soát quyền truy cập.
4. **Phản hồi & Ép kiểu (Context Injection):** Output từ Database được format (tiền tệ, ngày tháng) và truncate (nếu quá dài) rồi "mớm" ngược lại cho LLM dưới dạng tin nhắn ẩn (Hidden System Message).
5. **Tổng hợp (Synthesis):** LLM dựa vào cục Data thực tế đó biên dịch thành câu trả lời tiếng Việt thân thiện với User.

> 🧠 **Key Takeaway:** OpenClaw **KHÔNG** phải là AI. Nó là "Trình điều phối" tự động hóa toàn bộ vòng lặp giao tiếp giữa User -> Não AI (LLM) -> Cơ sở dữ liệu.

---

## II. Danh Mục 28 Tools & Đặc Tả Chi Tiết (Dạng Bảng)

Hệ thống sở hữu 28 Tools được chia làm 6 nhóm chính.

### 📑 Nhóm 1: Quản Trị Hợp Đồng (Contract Management)

| Tool Name | Chức năng & Lưu ý | Prompts Ví Dụ |
| :--- | :--- | :--- |
| **`search_contracts`** | **Chức năng:** Tìm kiếm danh sách HĐ (giới hạn 10 HĐ).<br>**Lưu ý:** Có logic Allocation-Aware. Không dùng đếm tổng. | - *"Tìm các hợp đồng thiết kế dự án Mailand trong năm ngoái."*<br>- *"Liệt kê 5 hợp đồng đang thi công của phòng số 2."*<br>- *"Có hợp đồng nào của Vingroup vừa ký tháng này không?"*<br>- *"Show danh sách các hợp đồng bị hủy."* |
| **`get_contract_detail`** | **Chức năng:** Truy xuất chi tiết sâu (milestones, phân bổ doanh thu, rủi ro) qua `contractId`. | - *"Hợp đồng XD-1234 dạo này thanh toán sao rồi, có rủi ro gì không?"*<br>- *"Xem chi tiết tiến độ giải ngân của hợp đồng số 456."*<br>- *"Dự án LandMark chia doanh thu cho các phòng nào?"*<br>- *"Lấy thông tin chi tiết hợp đồng thiết kế nhà xưởng."* |
| **`get_contract_stats`** | **Chức năng:** Tính tổng `sum` (doanh thu, tiền thu) và đếm `count`. | - *"Năm nay công ty chốt được tổng giá trị bao nhiêu?"*<br>- *"Tổng số hợp đồng phòng kỹ thuật đang xử lý là mấy?"*<br>- *"Doanh thu quý 1 hiện tại đạt bao nhiêu tỷ rồi?"*<br>- *"Đếm tổng số hợp đồng đã nghiệm thu trong tháng 9."* |
| **`get_overdue_contracts`** | **Chức năng:** Báo cờ đỏ HĐ trễ hạn thanh toán/kết thúc. | - *"Lọc cho tôi các HĐ có cảnh báo đỏ tuần này."*<br>- *"Có hợp đồng nào đang quá hạn nghiệm thu không?"*<br>- *"Danh sách các hợp đồng chậm tiến độ thanh toán."*<br>- *"Báo cáo các hợp đồng đang bị trễ hạn hơn 30 ngày."* |
| **`get_contract_expiry_timeline`** | **Chức năng:** Timeline HĐ sắp hết hạn (30/60/90 ngày tới). | - *"Sắp tới có HĐ nào cần thanh lý hay gia hạn không?"*<br>- *"Cho xem danh sách hợp đồng hết hạn trong 60 ngày tới."*<br>- *"Có hợp đồng nào đáo hạn tháng sau không?"*<br>- *"Cảnh báo các hợp đồng sắp kết thúc thời hạn thi công."* |

### 💰 Nhóm 2: Tài Chính, Kế Toán & Dòng Tiền (Financials)

| Tool Name | Chức năng & Lưu ý | Prompts Ví Dụ |
| :--- | :--- | :--- |
| **`search_payments`** | **Chức năng:** Tìm kiếm chứng từ (phiếu thu, phiếu chi, hóa đơn). | - *"Tìm phiếu chi tạm ứng cho dự án VinSmart tháng 5."*<br>- *"Kiểm tra xem hóa đơn VAT của Hòa Bình đã xuất chưa."*<br>- *"Tìm các phiếu thu tiền tuần trước."*<br>- *"Lấy danh sách các khoản chi cho đối tác ABC."* |
| **`get_debt_report`** | **Chức năng:** Tổng hợp công nợ Khách hàng, xác định nợ quá hạn. | - *"Xuất báo cáo công nợ hiện tại, ai đang nợ ác nhất?"*<br>- *"Vingroup còn nợ mình bao nhiêu tiền?"*<br>- *"Cập nhật tình hình thu hồi nợ tuần này."*<br>- *"Báo cáo các khoản nợ xấu quá hạn trên 90 ngày."* |
| **`get_cashflow_summary`** | **Chức năng:** Đối soát dòng tiền Thu - Chi theo tháng/quý. | - *"Dòng tiền quý 1 năm nay dương hay âm?"*<br>- *"Tổng hợp thu chi tháng trước giúp tôi."*<br>- *"Báo cáo lưu chuyển tiền tệ quý này."*<br>- *"Tính giúp tổng tiền vào túi so với tiền xuất ra tháng 8."* |
| **`get_revenue_forecast`** | **Chức năng:** Dự báo doanh thu pipeline có trọng số. Trả JSON Chart. | - *"Dự báo doanh thu pipeline từ nay đến cuối năm."*<br>- *"Phân tích khả năng đạt mốc doanh thu tháng tới."*<br>- *"Dự đoán dòng tiền sắp về từ các hợp đồng đang chạy."*<br>- *"Biểu đồ dự báo tiến độ doanh thu quý 4."* |
| **`get_expense_breakdown`** | **Chức năng:** Cơ cấu chi phí (lương, quản lý...). Trả JSON Chart. | - *"Quý vừa rồi công ty đốt tiền vào khoản gì nhiều nhất?"*<br>- *"Phân tích chi phí vận hành tháng trước."*<br>- *"Cho xem biểu đồ các khoản mục chi phí lớn nhất."*<br>- *"Tháng rồi mình chi quỹ lương hết bao nhiêu?"* |
| **`get_budget_variance_report`**| **Chức năng:** Đối chiếu Budget (Ngân sách) vs Thực tế kinh doanh. | - *"Các phòng ban đạt bao nhiêu % ngân sách năm nay rồi?"*<br>- *"Xem báo cáo đối chiếu ngân sách quý 3."*<br>- *"Phòng Kỹ Thuật có vượt hạn mức chi phí không?"*<br>- *"Ai đang hụt KPI ngân sách nhất tháng này?"* |

### 🤝 Nhóm 3: Quản Trị Quan Hệ Khách Hàng (CRM)

| Tool Name | Chức năng & Lưu ý | Prompts Ví Dụ |
| :--- | :--- | :--- |
| **`search_customers`** | **Chức năng:** Tra cứu thông tin đối tác/khách hàng cơ bản. | - *"Lấy mã số thuế của công ty Hòa Bình."*<br>- *"Tìm địa chỉ email của đại diện FPT."*<br>- *"Danh sách khách hàng trong mảng bất động sản."*<br>- *"Kiểm tra thông tin liên hệ của dự án SunGroup."* |
| **`get_customer_360`** | **Chức năng:** Báo cáo 360° khách hàng (quy mô HĐ, nợ góc, cảnh báo). | - *"Đánh giá toàn diện tệp hợp đồng với đối tác Vingroup giúp tôi."*<br>- *"Cho xem hồ sơ 360 độ của công ty Xây dựng số 1."*<br>- *"Tình hình hợp tác với đối tác Hòa Bình dạo này tốt không?"*<br>- *"Phân tích rủi ro khi làm ăn với khách hàng ABC."* |

### 📊 Nhóm 4: Báo Cáo Phân Tích & Giám Đốc (Analytics)

| Tool Name | Chức năng & Lưu ý | Prompts Ví Dụ |
| :--- | :--- | :--- |
| **`get_dashboard_kpi`** | **Chức năng:** Dashboard KPI cấp công ty/đơn vị. | - *"Dashboard KPI tháng 8 ra sao?"*<br>- *"Hiển thị bảng điều khiển hiệu suất quý 2."*<br>- *"Lấy KPI tổng quan của phòng 3."*<br>- *"Xem nhanh chỉ số sức khỏe doanh nghiệp."* |
| **`get_comparative_report`** | **Chức năng:** Báo cáo tăng trưởng (MoM, YoY). Trả đồ thị. | - *"So sánh kết quả ký kết tháng này so với tháng trước."*<br>- *"Báo cáo lợi nhuận năm nay so với cùng kỳ năm ngoái."*<br>- *"Sự khác biệt doanh thu giữa Quý 1 và Quý 2."*<br>- *"Tốc độ tăng trưởng tháng này là bao nhiêu phần trăm?"* |
| **`get_unit_ranking`** | **Chức năng:** Xếp hạng các phòng ban/Xí nghiệp. | - *"Top 3 đơn vị xuất sắc nhất mảng ký kết là ai?"*<br>- *"Xếp hạng lợi nhuận các phòng ban tháng này."*<br>- *"Đơn vị nào đang đứng chót bảng doanh thu?"*<br>- *"Cho xem bảng vinh danh top phòng ban quý 1."* |
| **`get_daily_briefing`** | **Chức năng:** Bản tin Flash nhanh vào sáng (Nợ, Trễ hạn, Cảnh báo). | - *"Viết cho tôi bản tin sáng hôm nay."*<br>- *"Tóm tắt nhanh tình trạng công ty lúc này."*<br>- *"Hôm nay có gì nóng cần xử lý ngay không?"*<br>- *"Cập nhật chớp nhoáng các việc tới hạn."* |
| **`get_comprehensive_report`** | **Chức năng:** Máy in báo cáo cấp cao (Markdown, Biểu đồ). | - *"Lập báo cáo tổng kết tình hình kinh doanh năm 2026."*<br>- *"Xuất báo cáo toàn diện hoạt động tháng vừa qua."*<br>- *"Cung cấp bản tổng kết năm chi tiết nhất có thể."*<br>- *"Soạn báo cáo đánh giá hiệu quả kinh doanh."* |
| **`get_smart_insights`** | **Chức năng:** AI phân tích chéo, phát hiện điểm yếu, đề xuất quyết định. | - *"Phân tích tổng quan và cho tôi vài lời khuyên chiến lược hôm nay."*<br>- *"Chỉ ra điểm nghẽn của công ty hiện tại và cách giải quyết."*<br>- *"AI có phát hiện rủi ro ngầm nào trong số liệu không?"*<br>- *"Tối ưu hóa nguồn lực: Bữa nay Giám đốc nên làm gì?"* |

### 👥 Nhóm 5: Nhân Sự & Vận Hành (HR & Tasks)

| Tool Name | Chức năng & Lưu ý | Prompts Ví Dụ |
| :--- | :--- | :--- |
| **`search_employees`** | **Chức năng:** Tìm kiếm nhân sự. | - *"Tìm số điện thoại của anh Thanh phòng IT."*<br>- *"Lấy email của kế toán trưởng."*<br>- *"Tìm nhân sự phụ trách marketing."*<br>- *"Ai là giám đốc dự án hiện tại?"* |
| **`get_hr_headcount_stats`** | **Chức năng:** Report quy mô nhân sự và pipeline tuyển dụng. | - *"Tình hình nhân sự và tuyển dụng tuần này thế nào?"*<br>- *"Công ty đang có bao nhiêu nhân viên?"*<br>- *"Tiến độ vòng tuyển dụng vị trí Developer đến đâu rồi?"*<br>- *"Phân bổ headcount các chi nhánh hiện tại."* |
| **`create_task_ai`** | **Chức năng:** AI tự động tạo Kanban task từ lời nói. | - *"Giao cho Nga IT xử lý lỗi server trước thứ 5."*<br>- *"Nhắc team kỹ thuật nộp báo cáo vào chiều mai."*<br>- *"Tạo task nhắc Kiên đòi nợ hợp đồng VinSmart gấp."*<br>- *"Thêm việc thiết kế logo giao cho team design."* |
| **`get_employee_workload`** | **Chức năng:** Phân tích độ tải (Ai rảnh/Ai bận). | - *"Ai đang bận nhất đội dự án lúc này?"*<br>- *"Kiểm tra khối lượng công việc của Nam tuần này."*<br>- *"Xem có ai rảnh để giao việc thêm không?"*<br>- *"Thống kê các nhân viên đang bị overload."* |
| **`approve_task`** | **Chức năng:** Duyệt/Từ chối task ngay từ cửa sổ chat. | - *"Duyệt cho tôi cái task nộp báo cáo thuế tuần này."*<br>- *"Từ chối đề xuất ngân sách của phòng 3."*<br>- *"OK, task lập trình xong rồi, tôi duyệt."*<br>- *"Không đồng ý với bản thiết kế này, hủy task."* |

### 🗂️ Nhóm 6: Tiện Ích & Kiến Thức (Utility & Knowledge Base)

| Tool Name | Chức năng & Lưu ý | Prompts Ví Dụ |
| :--- | :--- | :--- |
| **`export_document`** | **Chức năng:** Gen ra file PDF/Excel bảng biểu. | - *"Xuất danh sách HĐ đang xử lý ra file Excel."*<br>- *"Tải báo cáo doanh thu dưới dạng PDF."*<br>- *"Tạo file lưu trữ công nợ khách hàng quý 1."*<br>- *"Xuất file chi tiết HĐ XD-999."* |
| **`send_notification_email`**| **Chức năng:** Gửi email/thông báo hệ thống. | - *"Gửi email nhắc anh Tuấn thanh toán hóa đơn."*<br>- *"Bắn thông báo toàn công ty báo họp giao ban."*<br>- *"Push noti cho phòng kế toán chuẩn bị giải ngân."*<br>- *"Email báo cáo kết quả doanh thu cho chủ tịch."* |
| **`search_knowledge_base`** | **Chức năng:** RAG: Truy vấn kho Quy trình/Policy. | - *"Quy trình duyệt hợp đồng trên 1 tỷ theo ISO mới nhất thế nào?"*<br>- *"Quy định về công tác phí kỹ sư đi dự án ra sao?"*<br>- *"Chính sách bảo hành hợp đồng thi công là gì?"*<br>- *"Tìm hướng dẫn xin nghỉ phép năm."* |
| **`search_document_registry`**| **Chức năng:** Tìm kiếm File/Document được mã hoá metadata. | - *"Tìm cái bản scan hợp đồng của HĐ thiết kế Vingroup."*<br>- *"Tra cứu file PDF hóa đơn số 12345."*<br>- *"Lấy bản nghiệm thu của dự án Mailand."*<br>- *"Tìm các tài liệu pháp lý liên quan đến đối tác ABC."* |

---

## III. Multi-Tool Calling Prompts (Kỹ Thuật Chain-of-Thought)

Agent có thể chạy nhiều Tools liên hoàn (Song song hoặc Nối tiếp) nếu User lệnh phức tạp:

### Mẫu 1: Xâu Chuỗi (Sequential Connection)
> **User Prompt:** *"Tìm hợp đồng XD-999 sau đó xem nó còn nợ bao nhiêu, nếu nợ thì tạo task giao cho Kiên bốc máy đòi ngay."*
- **Quy trình AI gọi Tools:**
  1. `search_contracts({search: "XD-999"})` -> Lấy contract UUID.
  2. `get_contract_detail({contractId: UUID})` -> Xác định số dư nợ > 0.
  3. `search_employees({name: "Kiên"})` -> Hứng user UUID của Kiên.
  4. `create_task_ai({title: "Đòi nợ HĐ XD-999", assigneeId: KiênUUID, deadline: "today"})`
- **Output AI:** Hoàn tất cả 3 tác vụ và báo cáo lại "Đã check nợ 5 tỷ và tạo task cho Kiên.".

### Mẫu 2: Truy Vấn Song Song (Parallel Retrieval)
> **User Prompt:** *"Cho tôi biết dòng tiền quỹ này có âm không, so với ngân sách ra sao, và liệt kê các nguồn chi phí đi."*
- **Quy trình AI gọi Tools:**
  1. `getCashflowSummaryTool({period: "quarterly"})`
  2. `getBudgetVarianceReportTool({})`
  3. `getExpenseBreakdownTool({})`
- AI sẽ bắn 3 lệnh cùng lúc xuống server. Khi cả 3 chạy xong, AI gộp chung kết quả để báo cáo tư vấn.

---

## IV. Cẩm Nang Developer (Developer Guidelines)

Khi bạn muốn thêm Tool thứ 29 hoặc sửa 28 Tools hiện tại:

1. **Hiểu Mệnh Lệnh Định Cấu Hình (Schema Description):**
   - Đừng chỉ mô tả: `Tìm hợp đồng`. 
   - Hãy mô tả kỹ thuật Prompt engineering: `Sử dụng để tìm kiếm hợp đồng. Hỗ trợ lọc theo trạng thái, ngày. Dùng BẮT BUỘC khi hỏi danh sách HĐ. Không dùng để đếm.`

2. **Quy tắc Trọng Số Context Token:**
   - LLM có giới hạn đọc Token (thường 8k-16k cho Output Tool).
   - Nếu Tool `search_contracts` trả về 100 dòng x 50 properties `->` vỡ context.
   - **Luôn Luôn:** `.select('id, title, value')` (chỉ lấy field cần thiết) và `.limit(10)`.

3. **Luôn Bọc Zero-Trust Bằng Context:**
   ```typescript
   export const getSecretTool: OpenClawTool = {
     execute: async (args, context) => { // context chứa JWT identity
       if (!context.roles?.includes('DIRECTOR')) {
         return { error: 'Từ chối: Bạn không phải Giám đốc!' }
       }
       // ... fetching
     }
   }
   ```

4. **Tối ưu Markdown & JSON BI Charts:**
   - Đối với các Tool Báo cáo (`get_comprehensive_report`, `get_smart_insights`), bạn cần kết xuất raw Markdown ngay từ phía logic Backend để ép LLM không sửa số.
   - Đính kèm biểu đồ bằng cú pháp nội bộ ` \`\`\`chart {json} \`\`\` ` để Frontend render ra thẻ Recharts.
