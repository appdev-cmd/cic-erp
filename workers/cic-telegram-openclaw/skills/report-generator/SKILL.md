---
name: report_generator
description: Tạo báo cáo tùy chỉnh — doanh thu, hợp đồng, task theo nhiều format
metadata: {"openclaw":{"emoji":"📑","os":["linux","darwin"],"always":true}}
---

# Report Generator — Tạo báo cáo

Khi user yêu cầu tạo báo cáo tùy chỉnh:

1. Xác định loại báo cáo: doanh thu, hợp đồng, công nợ, task
2. Xác định khoảng thời gian (quý, tháng, năm)
3. Xác định format (xlsx, docx, text)

Quy trình:
- Thu thập dữ liệu từ các tool phù hợp
- Format kết quả rõ ràng
- Nếu user muốn file, dùng save_report hoặc export_xlsx/export_docx
- Nếu user muốn xem nhanh, hiển thị text

Hỗ trợ:
- "Báo cáo kinh doanh quý 1" → revenue + contracts Q1
- "Tổng hợp công nợ tháng 3" → overdue + payments tháng 3
- "Xuất danh sách HĐ năm 2025 ra excel" → export_xlsx

Ví dụ trigger: "tạo báo cáo", "lập báo cáo", "xuất báo cáo", "report"
