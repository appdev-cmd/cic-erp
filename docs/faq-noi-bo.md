# Câu hỏi Thường gặp (FAQ) — CIC-ERP

## Đăng nhập & Tài khoản

**Q: Quên mật khẩu, làm sao đăng nhập?**
A: Sử dụng tính năng "Quên mật khẩu" trên trang đăng nhập. Hệ thống sẽ gửi link reset qua email công ty. Nếu không nhận được, liên hệ Admin.

**Q: Tôi có thể đăng nhập từ điện thoại không?**
A: Có, giao diện ERP responsive, hoạt động trên mọi trình duyệt. Tuy nhiên, nên dùng máy tính để có trải nghiệm tốt nhất.

## Hợp đồng

**Q: Tôi muốn tìm hợp đồng theo số HĐ hoặc tên khách hàng?**
A: Vào menu "Hợp đồng" → sử dụng ô tìm kiếm ở trên cùng. Hỗ trợ tìm theo: mã HĐ, tên HĐ, tên khách hàng.

**Q: Làm sao xuất danh sách hợp đồng ra Excel?**
A: Trang danh sách hợp đồng → Nhấn nút "Xuất Excel" (hoặc "Xuất Word"). File sẽ tải về máy. Hoặc hỏi AI: "Xuất danh sách hợp đồng quý 1 ra Excel".

**Q: Hợp đồng đã ký rồi, có sửa được không?**
A: Hợp đồng đã ký chỉ có thể sửa bởi Manager hoặc Admin. Nếu cần thay đổi giá trị/phạm vi, tạo Phụ lục Hợp đồng mới.

**Q: Tôi chỉ thấy hợp đồng của đơn vị mình, sao không thấy của đơn vị khác?**
A: Đây là quy tắc phân quyền. Nhân viên chỉ thấy hợp đồng thuộc đơn vị mình. Nếu cần xem đơn vị khác, liên hệ Manager hoặc Admin.

## Thanh toán & Công nợ

**Q: "Thanh toán quá hạn" nghĩa là gì?**
A: Khi một đợt thanh toán có ngày hẹn đã qua nhưng trạng thái vẫn "Chưa thu", hệ thống tự đánh dấu là "Quá hạn". Cần liên hệ khách hàng để đôn đốc.

**Q: Làm sao biết tổng công nợ phải thu?**
A: Xem trên Dashboard — mục "Tổng công nợ phải thu". Hoặc hỏi AI: "Tổng công nợ hiện tại bao nhiêu?".

## AI Trợ lý

**Q: AI trả lời sai số liệu, phải làm sao?**
A: AI lấy dữ liệu từ database ERP. Nếu sai, có thể do: (1) Dữ liệu chưa được cập nhật trên ERP, (2) AI hiểu nhầm câu hỏi. Hãy hỏi lại rõ ràng hơn.

**Q: AI có lưu cuộc trò chuyện của tôi không?**
A: Lịch sử chat được lưu trên trình duyệt của bạn (localStorage). Không gửi lên server. Bạn có thể xóa bất kỳ lúc nào.

**Q: Tôi có thể dùng AI để soạn email/công văn không?**
A: Có! Chọn agent "Soạn thảo" trong module AI Phân tích. AI sẽ soạn email, tờ trình, công văn theo format chuẩn.

**Q: Local AI là gì? Tại sao nên dùng?**
A: Local AI (Ollama) chạy trực tiếp trên máy chủ công ty, dữ liệu KHÔNG gửi ra internet. Đảm bảo bảo mật tối đa cho thông tin nội bộ.

## Báo cáo

**Q: Muốn xem doanh thu theo quý, làm sao?**
A: Vào Dashboard → Biểu đồ doanh thu. Hoặc hỏi AI: "Doanh thu quý 1 năm 2026 bao nhiêu?".

**Q: Có thể xuất báo cáo tự động không?**
A: Hiện tại hỗ trợ xuất thủ công (Excel/Word). Tính năng báo cáo tự động đang được phát triển.
