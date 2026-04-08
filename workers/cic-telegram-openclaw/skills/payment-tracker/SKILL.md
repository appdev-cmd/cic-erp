---
name: payment_tracker
description: Theo dõi và cảnh báo thanh toán — quá hạn, sắp đến hạn, nhắc nhở
metadata: {"openclaw":{"emoji":"💰","os":["linux","darwin"],"always":true}}
---

# Payment Tracker — Theo dõi thanh toán

Khi user hỏi về thanh toán, công nợ, phải thu, phải trả:

1. Lấy danh sách thanh toán quá hạn (overdue_payments)
2. Phân loại theo mức độ quá hạn: dưới 30 ngày, 30-60 ngày, trên 60 ngày
3. Tính tổng giá trị nợ theo từng nhóm

Đưa ra:
- Bảng tóm tắt công nợ
- Top 5 khoản quá hạn lớn nhất
- Đề xuất ưu tiên thu hồi
- Cảnh báo khách hàng rủi ro cao

Ví dụ trigger: "tình hình công nợ", "theo dõi thanh toán", "ai nợ nhiều nhất", "nhắc thanh toán"
