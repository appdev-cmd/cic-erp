---
name: erp_summary
description: Phân tích tổng quan tình hình doanh nghiệp — hợp đồng, doanh thu, công nợ, nhân sự
metadata: {"openclaw":{"emoji":"📊","os":["linux","darwin"],"always":true}}
---

# ERP Summary — Phân tích tổng quan doanh nghiệp

Khi user hỏi về tình hình tổng quan công ty, phân tích doanh nghiệp, hoặc cần đánh giá hiện trạng:

1. Gọi tool `dashboard()` để lấy số liệu tổng quan
2. Gọi `overdue_payments()` để đánh giá rủi ro công nợ
3. Gọi `revenue_report(year)` để phân tích xu hướng doanh thu

Phân tích và đưa ra nhận xét:
- So sánh doanh thu các quý
- Đánh giá tỷ lệ công nợ quá hạn
- Nhận định rủi ro và đề xuất cải thiện
- Trả lời bằng tiếng Việt, phong cách chuyên nghiệp

Ví dụ trigger: "phân tích tình hình công ty", "đánh giá doanh nghiệp", "tổng quan kinh doanh"
