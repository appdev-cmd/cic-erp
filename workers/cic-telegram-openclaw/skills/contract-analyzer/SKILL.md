---
name: contract_analyzer
description: Phân tích sâu hợp đồng — rủi ro, tiến độ, và đề xuất hành động
metadata: {"openclaw":{"emoji":"📋","os":["linux","darwin"],"always":true}}
---

# Contract Analyzer — Phân tích hợp đồng chuyên sâu

Khi user hỏi về phân tích hợp đồng, rủi ro hợp đồng, hoặc cần review:

1. Phân tích các hợp đồng sắp hết hạn (expiring_contracts)
2. Kiểm tra thanh toán quá hạn liên quan (overdue_payments)
3. Tìm kiếm hợp đồng cụ thể nếu user đề cập (search_contracts)

Đưa ra phân tích:
- Hợp đồng nào cần gia hạn gấp
- Khách hàng nào có rủi ro nợ xấu
- Đề xuất hành động cụ thể cho từng hợp đồng
- Ưu tiên theo mức độ khẩn cấp

Ví dụ trigger: "phân tích hợp đồng", "rủi ro hợp đồng", "review HĐ", "hợp đồng nào cần xử lý"
