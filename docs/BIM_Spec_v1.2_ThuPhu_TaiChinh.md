

**TÀI LIỆU ĐẶC TẢ CHỨC NĂNG**

**Phần mềm Quản lý Dự án Tư vấn BIM**

Phiên bản 1.2  —  Bổ sung Module Thầu phụ & Tài chính dự án

Ngày cập nhật: 04/05/2026

# **1\. Tổng quan hệ thống**

Phần mềm Quản lý Dự án Tư vấn BIM là hệ thống nội bộ phục vụ toàn bộ vòng đời các dự án tư vấn BIM — từ tiếp cận khách hàng, đấu thầu, triển khai đến thanh quyết toán và quản lý tài chính.

Hệ thống bao gồm 7 module chính:

* Module 1 — Quản lý thông tin dự án

* Module 2 — Quản lý thông tin liên hệ

* Module 3 — Quản lý giai đoạn và task

* Module 4 — Quản lý nhân sự tham gia dự án

* Module 5 — Quản lý báo giá

* **Module 6 — Quản lý thầu phụ  \[PHIÊN BẢN NÀY\]**

* **Module 7 — Quản lý tài chính dự án  \[PHIÊN BẢN NÀY\]**

# **2\. Module 1 — Quản lý thông tin dự án**

## **2.1 Mô tả chức năng**

Module trung tâm của hệ thống. Mỗi dự án là một bản ghi riêng biệt, là cơ sở tham chiếu cho tất cả các module khác. Lưu ý: Trường Giá trị hợp đồng chính được bổ sung trong phiên bản này — là đầu vào doanh thu cho Module Tài chính.

## **2.2 Các trường dữ liệu**

| Trường dữ liệu | Mô tả / Ràng buộc |
| ----- | ----- |
| **Tên dự án** | Chuỗi ký tự, bắt buộc |
| **Mã dự án** | Tự sinh BIM-YYYY-XXX |
| **Cấp công trình** | Dropdown: Cấp đặc biệt / Cấp I / II / III / IV |
| **Loại công trình** | Dropdown: Dân dụng / Công nghiệp / Hạ tầng / Nông nghiệp / Quốc phòng |
| **Diện tích sàn (m²)** | Số thực, bắt buộc, \> 0 |
| **Diện tích xây dựng (m²)** | Số thực, bắt buộc, \> 0 |
| **Giá trị hợp đồng chính (đồng)** | Số thực, nhập khi ký HĐ chính thức — dùng làm doanh thu trong Module Tài chính |
| **Ngày bắt đầu dự án** | Date, bắt buộc |
| **Trạng thái dự án** | Mới / Đang triển khai / Tạm dừng / Hoàn thành / Hủy |
| **Ghi chú** | Text area |

## **2.3 Lưu ý**

* Mã dự án tự sinh định dạng BIM-YYYY-XXX

* Giá trị hợp đồng chính chỉ nhập sau khi ký HĐ chính thức, không lấy từ báo giá

* Lưu audit log đầy đủ: người tạo, người sửa, thời điểm

# **3\. Module 2 — Quản lý thông tin liên hệ**

## **3.1 Cấu trúc dữ liệu liên hệ**

Mỗi dự án có nhiều đầu mối liên hệ từ các bên. Quan hệ một-nhiều (1 dự án — nhiều liên hệ).

| Tên người liên hệ | Chức vụ | Đơn vị công tác | Vai trò |
| ----- | ----- | ----- | ----- |
| Bắt buộc, chuỗi ký tự | Chuỗi ký tự | Tên tổ chức | CĐT / TVTK / NT / Sở |
| Số điện thoại | Email | Địa chỉ | Ghi chú |

## **3.2 Lưu ý**

* Trường Vai trò là dropdown tùy chỉnh: CĐT / TVTK / NT / BQL / Sở / Khác

* Nút gọi điện (tel:) và gửi email (mailto:) trực tiếp từ giao diện

# **4\. Module 3 — Quản lý giai đoạn và task**

## **4.1 Cấu trúc giai đoạn**

| Giai đoạn | Danh sách Task | Đầu ra (Output) | Trạng thái |
| ----- | ----- | ----- | ----- |
| **Chuẩn bị dự án** | • Gặp gỡ khách hàng• Demo giải pháp BIM | Biên bản họp, tài liệu demo | Chờ / Đang / Xong |
| **Đấu thầu** | • Làm Pre-BEP• Phương pháp luận• Chuẩn bị & nộp hồ sơ thầu | Pre-BEP, hồ sơ dự thầu | Chờ / Đang / Xong |
| **Ký kết hợp đồng** | • Đàm phán điều khoản• Ký kết chính thức | Hợp đồng được ký | Chờ / Đang / Xong |
| **Triển khai hợp đồng** | • Kế hoạch mô hình• Báo cáo va chạm• Bóc tách khối lượng• Bảo vệ với CĐT | BEP, mô hình BIM, báo cáo clash | Chờ / Đang / Xong |
| **Nghiệm thu** | • Chuẩn bị hồ sơ nghiệm thu• Nộp mô hình• Bảo vệ với Sở | Hồ sơ nghiệm thu, biên bản Sở | Chờ / Đang / Xong |
| **Thanh quyết toán** | • Chuẩn bị hồ sơ thanh toán | Hồ sơ quyết toán | Chờ / Đang / Xong |

## **4.2 Trường dữ liệu task**

| Trường dữ liệu | Kiểu dữ liệu / Ràng buộc | Ghi chú |
| ----- | ----- | ----- |
| **Tên task** | Chuỗi, bắt buộc | Theo danh sách cố định |
| **Giai đoạn** | Dropdown liên kết giai đoạn | Không thay đổi sau khi tạo |
| **Người thực hiện** | Danh sách nhân sự trong dự án | Cho phép gán nhiều người |
| **Ngày bắt đầu / kết thúc** | Date, kết thúc \>= bắt đầu | Bắt buộc |
| **Trạng thái** | Chờ / Đang thực hiện / Hoàn thành / Quá hạn | Auto chuyển Quá hạn nếu qua deadline |
| **Tài liệu đính kèm** | File upload (PDF, IFC, DWG, XLSX) | Giới hạn kích thước theo cấu hình |
| **Ghi chú / Nhận xét** | Text area, lịch sử nhận xét | Log thay đổi theo thời gian |

## **4.3 Lưu ý**

* Tự động khởi tạo 6 giai đoạn khi tạo dự án với trạng thái Chờ thực hiện

* Cảnh báo khi task sắp đến hoặc quá deadline

# **5\. Module 4 — Quản lý nhân sự**

## **5.1 Vai trò và phân quyền**

| Vai trò | Trách nhiệm chính | Quyền hạn trên hệ thống |
| ----- | ----- | ----- |
| **Người mang dự án về (BD)** | Phát triển kinh doanh, kết nối khách hàng | Xem tất cả, tạo dự án mới |
| **Người phụ trách dự án (PM)** | Điều phối toàn bộ dự án, báo cáo tiến độ | Toàn quyền trên dự án được phân công |
| **Người hỗ trợ triển khai** | Hỗ trợ PM, chuẩn bị tài liệu | Chỉnh sửa task, upload tài liệu |
| **Admin** | Quản trị hệ thống, phân quyền | Toàn quyền hệ thống |
| **Quản lý BIM (BIM Manager)** | Phê duyệt tiêu chuẩn BIM, kiểm soát chất lượng | Duyệt task, xem Tài chính |
| **Điều phối BIM (BIM Coordinator)** | Phối hợp các bộ môn, kiểm tra va chạm | Chỉnh sửa task, báo cáo clash |
| **Dựng hình BIM (BIM Modeler)** | Xây dựng mô hình 3D, bóc tách khối lượng | Xem và cập nhật task được giao |

## **5.2 Lưu ý**

* Phân quyền theo mô hình RBAC; chỉ PM, BIM Manager và Admin xem được Module Tài chính

* Thông báo nội bộ (in-app notification) khi được gán task

# **6\. Module 5 — Quản lý báo giá**

## **6.1 Thông tin đầu vào**

| STT | Trường nhập liệu | Kiểu dữ liệu | Ràng buộc / Ghi chú | Bắt buộc |
| :---: | ----- | ----- | ----- | :---: |
| 1 | **Loại công trình** | Dropdown | Dân dụng / Công nghiệp / Hạ tầng... | Có |
| 2 | **Diện tích sàn (m²)** | Số thực \> 0 | Nhập tay hoặc tự điền từ dự án | Có |
| 3 | **Diện tích xây dựng (m²)** | Số thực \> 0 | Nhập tay hoặc tự điền từ dự án | Có |
| 4 | **Phạm vi công việc** | Multi-select checkbox | Tạo lập / Thẩm tra / Quản lý / Thi công / Hoàn công | Có |
| 5 | **Giai đoạn thực hiện** | Multi-select checkbox | Thiết kế cơ sở / BVTC / Thi công / Hoàn công | Có |
| 6 | **Đơn giá (đồng/m²)** | Số thực \> 0, VNĐ | Nhập thủ công hoặc từ bảng giá chuẩn | Có |
| 7 | **Chi phí nhân công dự tính** | Số thực \> 0, VNĐ | Tổng chi phí nhân sự thực hiện dự án | Có |

## **6.2 Logic tính toán tự động**

| Chỉ tiêu | Công thức | Ý nghĩa |
| ----- | ----- | ----- |
| **PA1 – Giá theo m²** | Đơn giá × Diện tích sàn | Tính trên đơn giá đơn vị |
| **PA2 – Ngưỡng nhân công** | Chi phí nhân công × 4 | Đảm bảo bù đắp chi phí nhân lực |
| **Báo giá đề xuất** | **MAX (PA1, PA2)** | **Lấy giá trị lớn hơn** |
| **Cảnh báo** | Nếu PA1 \< PA2 → hiển thị cảnh báo đỏ | Nhắc tăng đơn giá |

## **6.3 Lưu ý**

* PA1 \= Đơn giá × Diện tích sàn; PA2 \= Chi phí nhân công × 4; Đề xuất \= MAX(PA1, PA2)

* Tính real-time phía frontend (onChange), lưu server khi nhấn Lưu

* Khi Thắng thầu → cho phép tạo dự án mới và tự điền thông tin từ báo giá

* Versioning: điều chỉnh sau khi gửi tạo phiên bản mới thay vì ghi đè

# **7\. Module 6 — Quản lý thầu phụ**

## **7.1 Mục đích và phạm vi**

Module quản lý thầu phụ theo dõi toàn bộ đối tác outsource (OS) tham gia thực hiện một phần công việc trong dự án BIM. Mỗi dự án có thể có một hoặc nhiều thầu phụ, mỗi thầu phụ có phạm vi công việc và giá trị hợp đồng riêng biệt.

Giá trị hợp đồng của từng thầu phụ được tổng hợp tự động làm chi phí OS trong Module Tài chính.

Cấu trúc dữ liệu gồm hai thực thể tách biệt:

* Hồ sơ thầu phụ (Subcontractor Profile): Thông tin cố định của đơn vị/cá nhân, dùng chung cho nhiều dự án

* Hợp đồng thầu phụ (Subcontract): Thông tin hợp đồng cụ thể giữa thầu phụ và một dự án, bao gồm phạm vi và giá trị

## **7.2 Hồ sơ thầu phụ (Subcontractor Profile)**

Danh sách thầu phụ toàn công ty — không gắn với dự án cụ thể. Khi lập hợp đồng thầu phụ trong một dự án, người dùng chọn từ danh sách này.

| STT | Trường dữ liệu | Kiểu dữ liệu | Bắt buộc | Ghi chú |
| :---: | ----- | ----- | :---: | ----- |
| 1 | **Tên thầu phụ** | Chuỗi ký tự | Có | Tên công ty hoặc cá nhân |
| 2 | **Mã thầu phụ** | Tự sinh: TP-YYYY-XXX | Tự động | Liên kết với dự án qua FK |
| 3 | **Người đại diện** | Chuỗi ký tự | Có | Tên người ký hợp đồng |
| 4 | **Chức vụ đại diện** | Chuỗi ký tự | Có | Giám đốc / Trưởng nhóm... |
| 5 | **Số điện thoại** | Chuỗi số | Có | Đầu mối liên hệ chính |
| 6 | **Email** | Email hợp lệ | Có | Dùng gửi thông báo |
| 7 | **Địa chỉ công ty** | Chuỗi ký tự | Không | Thông tin pháp lý |
| 8 | **Mã số thuế** | 10-13 ký tự số | Không | Phục vụ xuất hóa đơn VAT |
| 9 | **Số tài khoản ngân hàng** | Chuỗi số \+ tên ngân hàng | Không | Phục vụ thanh toán |
| 10 | **Lĩnh vực chuyên môn** | Multi-select | Có | BIM Kiến trúc / Kết cấu / MEP / Tổng hợp... |
| 11 | **Ghi chú** | Text area | Không | Đánh giá chất lượng, lưu ý hợp tác |

### **7.2.1 Lưu ý triển khai**

* Mỗi thầu phụ có trang hồ sơ riêng hiển thị lịch sử các dự án đã hợp tác

* Trường Lĩnh vực chuyên môn giúp lọc nhanh thầu phụ phù hợp khi lập hợp đồng

* Cho phép xuất danh sách thầu phụ dạng Excel để báo cáo

## **7.3 Hợp đồng thầu phụ (Subcontract)**

Mỗi bản ghi Hợp đồng thầu phụ là liên kết giữa một Dự án và một Thầu phụ, cụ thể hóa phạm vi công việc và các điều khoản tài chính. Một dự án có thể có nhiều hợp đồng thầu phụ.

| STT | Trường dữ liệu | Kiểu dữ liệu | Bắt buộc | Ghi chú |
| :---: | ----- | ----- | :---: | ----- |
| 1 | **Dự án liên kết** | Dropdown / FK dự án | Có | Chọn từ danh sách dự án |
| 2 | **Thầu phụ** | Dropdown / FK thầu phụ | Có | Chọn từ danh sách hồ sơ thầu phụ |
| 3 | **Số hợp đồng thầu phụ** | Chuỗi ký tự | Có | Số hợp đồng thực tế ký kết |
| 4 | **Phạm vi công việc** | Multi-select \+ Text area | Có | Tạo lập / Thẩm tra / Quản lý / Thi công / Hoàn công |
| 5 | **Mô tả chi tiết công việc** | Text area | Không | Các hạng mục bàn giao cụ thể |
| 6 | **Giai đoạn thực hiện** | Multi-select | Có | Thiết kế cơ sở / BVTC / Thi công / Hoàn công |
| 7 | **Giá trị hợp đồng thầu phụ (đồng)** | Số thực \> 0, VNĐ | Có | Giá trị OS — đưa vào Module Tài chính |
| 8 | **Ngày ký hợp đồng** | Date | Có |  |
| 9 | **Ngày bắt đầu / kết thúc** | Date range | Có | Kết thúc \>= bắt đầu |
| 10 | **Trạng thái hợp đồng** | Dropdown | Có | Đang soạn / Đã ký / Đang thực hiện / Đã nghiệm thu / Thanh lý |
| 11 | **Số tiền đã thanh toán (đồng)** | Số thực \>= 0 | Không | Cập nhật theo tiến độ thực tế |
| 12 | **Số tiền còn phải trả** | Tự tính \= Giá trị HĐ – Đã thanh toán | Tự động | Cập nhật real-time |
| 13 | **Tài liệu hợp đồng** | File upload (PDF, DOCX) | Không | Bản scan hợp đồng ký kết |
| 14 | **Ghi chú** | Text area | Không | Điều khoản đặc biệt, lưu ý |

## **7.4 Vòng đời trạng thái hợp đồng thầu phụ**

| Trạng thái | Ý nghĩa | Hành động hệ thống |
| ----- | ----- | ----- |
| **Đang soạn** | Chưa ký, đang chuẩn bị nội dung | Cho phép chỉnh sửa toàn bộ |
| **Đã ký** | Hợp đồng đã ký chính thức | Khóa Giá trị HĐ, chỉ cập nhật thanh toán |
| **Đang thực hiện** | Thầu phụ đang triển khai công việc | Cho phép cập nhật tiến độ, upload tài liệu |
| **Đã nghiệm thu** | Công việc hoàn thành, đã nghiệm thu | Chỉ cập nhật thanh toán, không sửa nội dung |
| **Thanh lý** | Hợp đồng thanh lý, tất toán xong | Khóa toàn bộ, chỉ cho xem |

## **7.5 Màn hình hiển thị đề xuất**

### **7.5.1 Tab Thầu phụ trong trang chi tiết dự án**

* Bảng liệt kê tất cả thầu phụ: Tên — Phạm vi — Giá trị HĐ — Đã thanh toán — Còn lại — Trạng thái

* Dòng tổng cộng cuối bảng: Tổng OS / Tổng đã trả / Tổng còn phải trả

* Nút Thêm thầu phụ mở form chọn từ danh sách hồ sơ \+ nhập thông tin hợp đồng

### **7.5.2 Trang danh sách thầu phụ toàn công ty**

* Bảng tổng hợp hồ sơ thầu phụ, lọc theo lĩnh vực và trạng thái hợp tác

* Click vào thầu phụ xem lịch sử dự án đã hợp tác và tổng giá trị đã giao

## **7.6 Lưu ý kỹ thuật**

* Quan hệ DB: Subcontractor (1) — (nhiều) Subcontract — (nhiều) Project

* Trường Số tiền còn lại tính tự động \= Giá trị HĐ – Đã thanh toán, cập nhật real-time

* Khi trạng thái HĐ \= Đã ký, khóa trường Giá trị hợp đồng, chỉ cho cập nhật thanh toán

* Mỗi lần cập nhật Đã thanh toán phải lưu log: ai cập nhật, bao nhiêu, thời điểm nào

# **8\. Module 7 — Quản lý tài chính dự án**

## **8.1 Mục đích và phạm vi**

Module Tài chính cung cấp phương án kinh doanh (business case) hoàn chỉnh cho từng dự án: tổng hợp toàn bộ thu – chi và tính ra Lợi nhuận gộp (LNG). Đây là bức tranh tài chính tổng thể giúp ban lãnh đạo đánh giá hiệu quả của từng hợp đồng.

Nguyên tắc vận hành:

* Giá trị có thể lấy tự động từ module khác (doanh thu từ HĐ chính, chi phí OS từ Module Thầu phụ, thưởng tính theo %) sẽ được tự động điền — không cần nhập lại

* Chỉ các khoản chi phí thực hiện phát sinh thực tế (công cụ, phần mềm, chi phí khác) cần nhập thủ công theo từng khoản

## **8.2 Cấu trúc phương án kinh doanh**

Bảng thu – chi đầy đủ của một dự án (màu xanh lá \= thu, màu đỏ \= chi, màu vàng \= kết quả):

| Loại | Nhóm | Hạng mục | Cách xác định giá trị | Dấu |
| :---: | :---: | ----- | ----- | :---: |
| **THU** | **Doanh thu** | **Doanh thu hợp đồng chính** | **Giá trị HĐ chính (nhập khi ký HĐ)** | **(+)** |
| **CHI** | **Chi phí OS** | Chi phí outsource thầu phụ | Tổng giá trị HĐ tất cả thầu phụ — lấy tự động từ Module Thầu phụ | **(–)** |
| **CHI** | **Chi phí TH** | Chi phí công cụ / dụng cụ | Mua sắm thiết bị phục vụ dự án — nhập từng khoản | **(–)** |
| **CHI** | **Chi phí TH** | Chi phí phần mềm | License phần mềm BIM sử dụng trong dự án | **(–)** |
| **CHI** | **Chi phí TH** | Chi phí khác | Đi lại, in ấn, họp, tiếp khách, phát sinh... | **(–)** |
| **CHI** | **Thưởng** | Thưởng bộ phận Kinh doanh (5%) | 5% × Doanh thu hợp đồng chính — tính tự động | **(–)** |
| **CHI** | **Thưởng** | Thưởng bộ phận Triển khai (5%) | 5% × Doanh thu hợp đồng chính — tính tự động | **(–)** |
| **KQ** | **LNG** | **LỢI NHUẬN GỘP (LNG)** | **Doanh thu – Tổng tất cả các khoản chi** | **\=** |

## **8.3 Công thức tính toán chi tiết**

| Chỉ tiêu | Công thức chi tiết |
| ----- | ----- |
| **Thưởng kinh doanh** | \= 5% × Doanh thu hợp đồng chính |
| **Thưởng triển khai** | \= 5% × Doanh thu hợp đồng chính |
| **Tổng chi phí OS** | \= SUM(Giá trị HĐ tất cả thầu phụ) — tự động từ Module Thầu phụ |
| **Tổng chi phí thực hiện** | \= Chi phí công cụ/dụng cụ \+ Phần mềm \+ Chi phí khác |
| **LNG** | **\= Doanh thu – OS thầu phụ – Chi phí thực hiện – Thưởng KD (5%) – Thưởng triển khai (5%)** |
| **Tỷ suất LNG (%)** | \= LNG / Doanh thu × 100%  —  hiển thị để so sánh hiệu quả giữa các dự án |

### **8.3.1 Ví dụ minh họa số liệu**

Dự án giả định để đội lập trình kiểm tra logic tính toán:

* Doanh thu hợp đồng chính: 2.000.000.000 đ

* Chi phí OS thầu phụ: 800.000.000 đ  (tự động từ Module Thầu phụ)

* Chi phí công cụ/dụng cụ: 50.000.000 đ

* Chi phí phần mềm: 30.000.000 đ

* Chi phí khác: 20.000.000 đ

* Thưởng KD (5%): 2.000.000.000 × 5% \= 100.000.000 đ  (tự động)

* Thưởng triển khai (5%): 2.000.000.000 × 5% \= 100.000.000 đ  (tự động)

Tổng chi \= 800 \+ 50 \+ 30 \+ 20 \+ 100 \+ 100 \= 1.100.000.000 đ

LNG \= 2.000.000.000 – 1.100.000.000 \= 900.000.000 đ

Tỷ suất LNG \= 900.000.000 / 2.000.000.000 × 100% \= 45%

## **8.4 Quản lý chi phí phát sinh thực tế**

Các khoản chi công cụ/dụng cụ, phần mềm và chi phí khác được quản lý dưới dạng danh sách từng khoản (chi tiết hóa từng hóa đơn, chứng từ):

| STT | Trường dữ liệu | Kiểu dữ liệu | Bắt buộc | Ghi chú |
| :---: | ----- | ----- | :---: | ----- |
| 1 | **Loại chi phí** | Dropdown | Có | OS / Công cụ / Phần mềm / Khác |
| 2 | **Tên khoản chi** | Chuỗi ký tự | Có | Ví dụ: License Revit 2024, Máy tính... |
| 3 | **Số tiền (đồng)** | Số thực \> 0, VNĐ | Có | Định dạng tiền tệ, làm tròn triệu |
| 4 | **Ngày phát sinh** | Date | Có |  |
| 5 | **Người chịu trách nhiệm** | FK nhân sự | Không | Người đề xuất / phê duyệt chi phí |
| 6 | **Chứng từ / Hóa đơn** | File upload (PDF, JPG) | Không | Hóa đơn VAT, phiếu chi... |
| 7 | **Trạng thái thanh toán** | Dropdown | Có | Chờ duyệt / Đã duyệt / Đã thanh toán |
| 8 | **Ghi chú** | Text area | Không |  |

### **8.4.1 Phân nhóm chi phí phần mềm**

* Phần mềm dựng hình: Autodesk Revit, ArchiCAD, Tekla Structures...

* Phần mềm phối hợp & kiểm tra: Autodesk Navisworks, Solibri Model Checker...

* Nền tảng CDE (Common Data Environment): Autodesk BIM 360, Autodesk ACC, Autodesk Docs...

* Phần mềm bóc tách khối lượng: Autodesk Takeoff, CostX...

### **8.4.2 Phân nhóm chi phí công cụ / dụng cụ**

* Máy tính, màn hình, máy in, thiết bị lưu trữ

* Thiết bị đo đạc, quét 3D phục vụ khảo sát thực địa

### **8.4.3 Phân nhóm chi phí khác**

* Đi lại: xăng, vé máy bay, taxi phục vụ dự án

* In ấn, văn phòng phẩm

* Họp, tiếp khách liên quan trực tiếp đến dự án

* Các phát sinh khác không thuộc nhóm trên

## **8.5 Dashboard tài chính dự án**

Trang tổng quan tài chính từng dự án hiển thị các chỉ số sau dưới dạng trực quan:

| Chỉ số | Cách tính | Hình thức hiển thị |
| ----- | ----- | ----- |
| **Doanh thu hợp đồng** | Giá trị HĐ chính đã ký | Số lớn, màu xanh dương |
| **Tổng chi phí OS thầu phụ** | Tổng từ Module Thầu phụ | Số màu đỏ, % so với doanh thu |
| **Tổng chi phí thực hiện** | Tổng các khoản chi nhập thủ công | Số màu đỏ, % so với doanh thu |
| **Thưởng KD \+ Thưởng TK** | 5% \+ 5% × Doanh thu | Số màu đỏ, hiển thị từng phần |
| **LNG (Lợi nhuận gộp)** | **Doanh thu – Tổng chi phí** | **Số nổi bật màu vàng / xanh lá** |
| **Tỷ suất LNG (%)** | LNG / Doanh thu × 100% | Thanh progress bar màu |
| **Tổng tiền đã thu từ CĐT** | Tổng các đợt thu thực tế | So sánh với doanh thu HĐ |
| **Tổng tiền đã trả thầu phụ** | Tổng Đã thanh toán từ Module Thầu phụ | So sánh với tổng OS |

### **8.5.1 Gợi ý thiết kế giao diện**

* Khu vực tóm tắt trên cùng: 4 metric card nổi bật — Doanh thu / Tổng chi / LNG / Tỷ suất LNG%

* Stacked bar chart: tỷ trọng từng loại chi phí trong tổng doanh thu (OS / Công cụ / Phần mềm / Thưởng / Còn lại)

* Progress bar thu tiền CĐT: Đã thu / Doanh thu HĐ

* Progress bar trả thầu phụ: Đã trả / Tổng OS

* Bảng chi tiết khoản chi: có thể lọc theo loại, tháng, trạng thái thanh toán

* Cảnh báo đỏ nổi bật nếu LNG \< 0

## **8.6 Quản lý tiến độ thu tiền từ chủ đầu tư**

Module cần theo dõi tiến độ thu tiền từ CĐT theo từng đợt thanh toán. Cấu trúc mỗi đợt thu bao gồm:

* Tên đợt thanh toán: Đợt 1, Đợt 2...

* Điều kiện thanh toán: Điều kiện hợp đồng để CĐT phải thanh toán đợt đó

* Giá trị theo hợp đồng (đồng): Số tiền CĐT phải trả theo HĐ cho đợt này

* Giá trị thực tế đã nhận (đồng): Số tiền thực tế đã nhận được

* Ngày dự kiến thu / Ngày thực tế thu

* Trạng thái: Chờ đủ điều kiện / Đã xuất hóa đơn / Đã nhận tiền

## **8.7 Lưu ý kỹ thuật triển khai**

* Doanh thu lấy từ Giá trị HĐ chính trong Module Dự án — KHÔNG lấy từ báo giá

* Tổng OS \= SUM(giá trị HĐ tất cả thầu phụ của dự án) — tự cập nhật khi thêm/sửa thầu phụ

* Thưởng KD và Thưởng TK tính tự động theo %; Admin có thể điều chỉnh tỷ lệ % trong cấu hình

* LNG và Tỷ suất LNG cập nhật real-time khi thêm/sửa bất kỳ khoản chi nào

* Tất cả giá trị tiền tệ làm tròn đến triệu đồng khi hiển thị

* Nếu LNG \< 0: hiển thị alert đỏ nổi bật, không cho phép ẩn cảnh báo

* Audit log đầy đủ cho mọi thao tác chỉnh sửa số liệu tài chính

* Phân quyền: chỉ PM, BIM Manager và Admin được xem và chỉnh sửa Module Tài chính

# **9\. Yêu cầu kỹ thuật chung**

## **9.1 Giao diện người dùng**

* Giao diện web responsive, tương thích desktop và tablet

* Trang chi tiết dự án chia tab: Thông tin / Liên hệ / Giai đoạn & Task / Nhân sự / Thầu phụ / Báo giá / Tài chính

* Dashboard toàn công ty: số dự án theo trạng thái, tổng LNG, tỷ lệ thắng thầu, workload nhân sự

## **9.2 Dữ liệu và bảo mật**

* Xác thực JWT token toàn bộ API

* Phân quyền RBAC: kiểm soát cả frontend (hiển thị/ẩn) lẫn backend (API endpoint)

* Audit log: mọi thao tác tạo/sửa/xóa trên tất cả module

## **9.3 Tích hợp tương lai**

* Xuất báo cáo tài chính dự án dạng PDF và Excel

* Cảnh báo tự động: LNG âm, task quá hạn, thầu phụ chưa thanh toán

* Bảng đơn giá chuẩn theo loại công trình để gợi ý trong Module Báo giá

* Tích hợp phần mềm kế toán nội bộ để đồng bộ số liệu tài chính

*\--- Hết tài liệu \---*