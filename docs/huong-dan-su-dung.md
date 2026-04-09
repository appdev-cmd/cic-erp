# Hướng dẫn Sử dụng CIC-ERP

## 1. Tổng quan
CIC-ERP là hệ thống quản trị doanh nghiệp nội bộ của Công ty CIC, bao gồm các module:
- **Quản lý Hợp đồng** — Theo dõi toàn bộ vòng đời hợp đồng từ soạn thảo đến quyết toán
- **Quản lý Tài chính** — Thanh toán, công nợ, doanh thu
- **Quản lý Khách hàng** — CRM và thông tin đối tác
- **Quản lý Nhân sự** — Hồ sơ nhân viên, chấm công, nghỉ phép
- **Kế hoạch Kinh doanh** — Lập và theo dõi kế hoạch
- **AI Phân tích** — Trợ lý AI hỗ trợ ra quyết định

## 2. Đăng nhập
- Truy cập hệ thống tại địa chỉ nội bộ
- Đăng nhập bằng email công ty (đuôi @cic.com.vn hoặc tương tự)
- Hệ thống sử dụng Supabase Auth, hỗ trợ xác thực OTP qua email/Telegram

## 3. Dashboard
Sau khi đăng nhập, trang Dashboard hiển thị:
- **Tổng số hợp đồng** và giá trị tổng
- **Hợp đồng đang thực hiện** (active)
- **Tổng công nợ phải thu** (receivables)
- **Thanh toán quá hạn** — danh sách cần theo dõi
- **Task cá nhân** — công việc được giao
- **Biểu đồ doanh thu theo tháng**

## 4. Quản lý Hợp đồng
### Tạo hợp đồng mới
1. Vào menu **Hợp đồng** → Nhấn **"+ Tạo mới"**
2. Điền thông tin: Số HĐ, Tên HĐ, Khách hàng, Giá trị, Ngày ký, Ngày kết thúc
3. Chọn đơn vị phụ trách và người chịu trách nhiệm
4. Nhấn **Lưu**

### Trạng thái hợp đồng
| Trạng thái | Mô tả |
|------------|-------|
| Mới tạo | Hợp đồng vừa được tạo, chưa ký |
| Đang thực hiện | Đã ký, đang triển khai |
| Tạm dừng | Tạm ngưng thực hiện |
| Hoàn thành | Đã nghiệm thu, quyết toán xong |
| Hủy | Hợp đồng bị hủy |

### Tìm kiếm hợp đồng
- Sử dụng ô tìm kiếm trên trang danh sách
- Lọc theo: trạng thái, đơn vị, khoảng thời gian, giá trị
- Export danh sách ra Excel/Word

## 5. Quản lý Thanh toán
- Mỗi hợp đồng có thể có nhiều đợt thanh toán
- Theo dõi: ngày hẹn thanh toán, số tiền, trạng thái (chưa thu, đã thu, quá hạn)
- Hệ thống tự động cảnh báo thanh toán quá hạn trên Dashboard

## 6. AI Trợ lý
### Chat nhanh (Popup)
- Nhấn icon 💬 ở góc phải dưới màn hình
- Hỏi bất kỳ câu hỏi nào về dữ liệu ERP
- Nhấn ⤢ để phóng lớn sang chế độ phân tích chuyên sâu

### Chế độ Phân tích (AI Assistant)
- Vào menu **AI Phân tích**
- Chọn agent: Tổng quát, Pháp chế, Soạn thảo, Phân tích số liệu
- Chọn model: Local AI (Ollama) hoặc Cloud (Gemini, GPT-4o, DeepSeek)
- Hỗ trợ nạp dữ liệu (Data Ingestion) để AI học thêm
