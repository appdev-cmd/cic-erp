---
name: lead_hunter
description: Tìm kiếm và trích xuất hồ sơ B2B Leads trên tự động (Kiểm kê GHG, tư vấn chứng chỉ)
metadata: {"openclaw":{"emoji":"🎯","always":false}}
---

# Lead Hunter — Quy trình Tìm Kiếm B2B Tự Động 3 Vòng

Marketing Agent khi chạy chức năng "tìm lead", "quét khách hàng" sẽ thực hiện các bước sau:

**Vòng 1: Tìm kiếm Diện Rộng**
Sử dụng `web_search` để quét:
- Các dự án Bất Động Sản, KCN, hạ tầng vừa khởi công / cấp phép.
- Hoặc các công ty Sản xuất lớn có định hướng xuất khẩu, ESG.
- Tập trung lấy tên công ty và thông tin ngắn gọn.

**Vòng 2: Lọc và Chấm Điểm**
Agent tự động phân loại, đọc và gán `potential_score` (0-100) dựa vào sự phù hợp với các dịch vụ cốt lõi: Kiểm kê GHG, Báo cáo kiểm kê, Tư vấn chứng chỉ (LEED, LOTUS).

**Vòng 3: Đào sâu thông tin Liên Hệ & Lưu trữ**
- Tiếp tục quét `web_search` chi tiết với các công ty pass Vòng 2 để dò tên Giám đốc, Ban quản lý dự án, HSE Manager.
- Sử dụng công cụ `save_lead` để PUSH dữ liệu cuối cùng vào pipeline trên hệ thống (bảng `mkt_leads`). 

**Tương tác mẫu:**
User: "Tìm giúp tôi danh sách dự án BĐS cấp phép 2 tháng qua"
Agent: Thực thi quy trình và báo cáo lại chi tiết trên Telegram.
