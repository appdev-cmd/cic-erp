---
name: "erp-business-logic"
description: "Quy chuẩn Định nghĩa Thuật ngữ Kinh doanh và Logic Mapping DB cho CIC-ERP. Đọc file này khi sửa Tools báo cáo hoặc System Prompt."
---

# CIC-ERP Business Logic & Dictionary

Tài liệu này đóng vai trò quan trọng trong việc thống nhất ngôn ngữ giữa Ban Lãnh đạo, Dữ liệu CSDL, và Hệ thống AI Agent của CIC-ERP. Mọi công cụ AI, module báo cáo, hoặc tính năng liên quan đến tài chính/nhân sự BẮT BUỘC tham chiếu logic tại đây.

## 1. Từ Điển KPI Định Mức

| Thuật ngữ UI/Người dùng | Thuật ngữ Tiếng Anh | Trường Database / Field API | Diễn giải tính toán |
| :--- | :--- | :--- | :--- |
| **Ký kết** | Signing | `value` / `totalSigning` | Tổng giá trị dự kiến hoặc đã ký hợp đồng. |
| **Doanh thu** | Revenue | `actual_revenue` / `totalRevenue` | Phần giá trị hợp đồng đã được nghiệm thu (chỉ trừ đi hoa hồng/phí không ghi doanh thu nếu có). Đây **không phải** là số tiền đã vào tài khoản. |
| **Dòng tiền** | Cash / Collected | Giá trị phiếu thu (`amount` có `voucherType=RECEIPT`) hoặc `totalCash` | Dòng tiền măt thực tế thu được từ khách hàng đưới dạng khoản ứng trước hoặc thanh toán. |
| **Lợi nhuận gộp QT** | Admin Profit | `admin_profit` / `totalProfit` | LN Gộp Quản Trị = Tổng Doanh thu HĐ - Tổng chi phí thực hiện ngân sách. |
| **Lợi nhuận gộp (DT)**| Rev Profit | `rev_profit` | LN Gộp tính theo hệ số doanh thu (dùng cho báo cáo cổ đông thường kỳ). |
| **Công nợ phải thu** | Receivables / Debt | HĐ có `receivables` > 0 | Phiếu thu / Xuất VAT chưa thanh toán. Công thức: Tổng VAT - Tổng thu = Phải thu. Nếu là cá nhân, tìm ở các payments đang Pending trễ hạn. |
| **Hợp đồng quá hạn** | Overdue Contracts | `end_date` < today AND `status` = 'Processing' | Các HĐ trễ hạn hoàn thành tiến độ so với ký kết ban đầu. |

## 2. Logic Ánh Xạ AI Tools (Mapping Rules)

Mỗi khi AI nhận được câu hỏi từ người dùng, hãy tuân theo ánh xạ bắt buộc này:

- ❌ Sai: Tự động cộng các chỉ số từ cơ sở dữ liệu hoặc bịa số liệu ra.
- ❌ Sai: Truy vấn trực tiếp SQL để tính biểu đồ khi câu hỏi nằm trong Top Dashboard.
- ✅ Bắt buộc: Kích hoạt đúng tool có sẵn trong `registry.ts`. Đưa nguyên văn bảng markdown mà Tool xuất ra cho người dùng.

### Rule Sets:
1. **Report tổng quan**: "Tôi muốn biết tình hình Q1", "Lấy dữ liệu kinh doanh năm nay" 
   👉 Gọi tool `get_dashboard_kpi`. Soát kết quả trường `kyKet`, `doanhThu`
2. **So sánh đa kỳ**: "So sánh số liệu Q1 năm nay với năm ngoái", "Phân tích H1" 
   👉 Gọi tool `get_comparative_report`. AI không được tự trừ số để ra phần trăm, tool đã làm sẵn.
3. **Danh sách / Bảng vàng**: "Phòng nào cao nhất", "Ai làm tốt nhất" 
   👉 Gọi tool `get_unit_ranking`. (Chú ý tham số `sortBy` phải đúng: `revenue`, `signing` hoặc `profit`).
4. **Cảnh báo (Alerts)**: "Tìm HĐ quá hạn", "Trễ deadline"
   👉 Gọi tool `get_overdue_contracts`.
   
## 3. Quy Củ Khi Mở Rộng Tool (Tech Guideline)
Khi bạn cần mở rộng 1 Tool ERP mới:
- KHÔNG trả về raw objects nếu dữ liệu lớn (sợ AI tính sai/bịa số). Hãy format thành bảng hoặc list markdown rõ ràng trong Service (vd: `fmtMoney` hoặc `JSON.stringify` Markdown Table) rồi nhét thẳng vào kết quả prompt.
- Khi truy vấn `contracts` nhớ lọc `status` cẩn thận. (Chỉ tính Hóa đơn / Ký kết nếu HĐ chưa bị Cancel/Huỷ/Chưa ký định danh).
