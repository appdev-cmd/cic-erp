# Quy trình Tài chính & Thanh toán

## 1. Quản lý Thanh toán Hợp đồng
Mỗi hợp đồng có thể chia thành nhiều đợt thanh toán:

### Loại thanh toán
| Loại | Mô tả | Thời điểm |
|------|-------|-----------|
| Tạm ứng | Thanh toán trước khi triển khai | Sau ký kết |
| Thanh toán theo tiến độ | Theo khối lượng hoàn thành | Trong quá trình thực hiện |
| Thanh toán cuối cùng | Sau nghiệm thu hoàn thành | Kết thúc hợp đồng |
| Bảo lãnh | Thanh toán sau thời gian bảo hành | 1-2 năm sau hoàn thành |

### Quy trình thanh toán
1. Lập hồ sơ thanh toán (đính kèm biên bản nghiệm thu)
2. Trình ký duyệt thanh toán (Trưởng phòng → Kế toán trưởng → Giám đốc)
3. Xuất hóa đơn VAT
4. Chuyển khoản / nhận tiền
5. Cập nhật trạng thái "Đã thanh toán" trên ERP

## 2. Quản lý Công nợ
### Công nợ phải thu (Receivables)
- Tổng giá trị hợp đồng đã ký nhưng chưa thu đủ tiền
- Hệ thống tự tính = Giá trị HĐ - Tổng đã thu
- Dashboard hiển thị tổng công nợ phải thu

### Thanh toán quá hạn (Overdue)
- Hệ thống tự phát hiện khi ngày thanh toán đã qua mà trạng thái vẫn "Chưa thu"
- Gửi cảnh báo trên Dashboard và notification
- Quá hạn > 30 ngày: cần báo cáo Ban Giám đốc
- Quá hạn > 90 ngày: cân nhắc biện pháp pháp lý

## 3. Báo cáo Doanh thu
### Doanh thu theo tháng
- ERP tổng hợp giá trị hợp đồng ký trong tháng
- Phân loại theo đơn vị thực hiện
- So sánh kế hoạch vs. thực tế

### Doanh thu theo quý
- Q1: Tháng 1 - 3
- Q2: Tháng 4 - 6
- Q3: Tháng 7 - 9
- Q4: Tháng 10 - 12

### Xuất báo cáo
- Xuất Excel (.xlsx) — dạng bảng, phù hợp phân tích số liệu
- Xuất Word (.docx) — dạng văn bản, phù hợp trình ký
- AI có thể tự động phân tích xu hướng doanh thu

## 4. Quản lý Ngân sách
- Mỗi đơn vị có ngân sách được phê duyệt hàng năm
- Theo dõi chi tiêu thực tế so với ngân sách
- Cảnh báo khi chi tiêu vượt 80% ngân sách
