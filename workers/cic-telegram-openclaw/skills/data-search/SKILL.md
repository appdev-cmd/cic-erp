---
name: data_search
description: Tìm kiếm thông minh trong ERP — hợp đồng, khách hàng, dự án
metadata: {"openclaw":{"emoji":"🔍","os":["linux","darwin"],"always":true}}
---

# Data Search — Tìm kiếm thông minh

Khi user tìm kiếm thông tin trong hệ thống ERP:

1. Phân tích từ khóa tìm kiếm
2. Sử dụng search_contracts để tìm hợp đồng
3. Kết hợp với dashboard nếu cần ngữ cảnh rộng hơn

Chiến lược tìm kiếm:
- Tên khách hàng → search_contracts(keyword)
- Mã hợp đồng → search_contracts(mã)
- Dự án → search_contracts(tên dự án)
- Nếu không tìm thấy, gợi ý từ khóa khác

Kết quả:
- Hiển thị kết quả phù hợp nhất trước
- Kèm thông tin liên quan (giá trị, trạng thái, ngày)
- Gợi ý hành động tiếp theo

Ví dụ trigger: "tìm khách hàng ABC", "hợp đồng nào liên quan đến X", "có dự án Y không"
