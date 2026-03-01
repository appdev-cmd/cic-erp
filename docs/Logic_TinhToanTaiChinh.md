# 📊 TÀI LIỆU LOGIC TÍNH TOÁN TÀI CHÍNH - CIC ERP

> **Phiên bản:** 1.1 | **Cập nhật:** 01/03/2026
> **Hệ thống:** CIC ERP - Hợp đồng & PAKD

Tài liệu này mô tả chi tiết các công thức, quy tắc làm tròn và logic nghiệp vụ được áp dụng trong hệ thống CIC ERP khi xử lý số liệu tài chính của Hợp đồng và Phương án kinh doanh (PAKD).

---

## 1. Các định nghĩa cơ bản

| Thuật ngữ | Ký hiệu trong Code | Định nghĩa |
|---|---|---|
| **Sản phẩm/Dịch vụ** | `LineItem` | Từng hạng mục được bán cho khách hàng (Gồm: Số lượng, Đơn giá nhập, Đơn giá bán, VAT, Chi phí trực tiếp). |
| **Giá Đầu vào** | `inputPrice` | Đơn giá mua vào từ Nhà cung cấp (chưa VAT). |
| **Giá Đầu ra** | `outputPrice` | Đơn giá bán cho Khách hàng (CHƯA VAT). |
| **Chi phí Trực tiếp** | `directCosts` | Chi phí phát sinh gắn liền trực tiếp với 1 hạng mục sản phẩm cụ thể (VD: phí vận chuyển loại hàng đó). |
| **Chi phí Thực hiện** | `executionCosts` | Chi phí chung để thực hiện hợp đồng, không gắn với 1 sản phẩm cụ thể (VD: Công tác phí, Phí bảo lãnh, Lãi vay). |
| **Chiết khấu NCC** | `supplierDiscount` | Tiền hoa hồng / chiết khấu từ Nhà cung cấp trả lại cho công ty. |

---

## 2. Công thức tính toán chi tiết

*Mọi phép toán tính tổng dưỡi đây đều ngầm định là làm phép tổng (`Σ`) qua tất cả các Hạng mục sản phẩm (`LineItem`).*

### 2.1. Nhóm chỉ tiêu Doanh thu (Revenue)

*   **Doanh thu (-VAT)** (`estimatedRevenue` hoặc `revenue`):
    *   **Ý nghĩa:** Tổng doanh số bán hàng chưa bao gồm thuế GTGT. Đây là con số quan trọng nhất để tính KPI doanh số và Lợi nhuận.
    *   **Công thức:** `Σ (Số lượng × Giá Đầu ra)`
    *   *Code snippet:* `lineItems.reduce((acc, item) => acc + (item.quantity * item.outputPrice), 0)`

*   **Giá trị Ký kết (Đã gồm VAT)** (`signingValue`):
    *   **Ý nghĩa:** Con số thể hiện trên mặt Hợp đồng ký kết với khách hàng. Khách hàng sẽ thanh toán theo con số này.
    *   **Công thức:** `Σ [Số lượng × Giá Đầu ra × (1 + % VAT Hạng mục)] + Chiết khấu NCC`
    *   *Lưu ý:* Chiết khấu NCC được hạch toán như một khoản làm tăng Giá trị dòng tiền (Ký kết).
    *   *Code snippet:* `lineItems.reduce((acc, item) => acc + (item.quantity * item.outputPrice * (1 + (item.vatRate ?? 10) / 100)), 0) + supplierDiscount;`

---

### 2.2. Nhóm chỉ tiêu Chi phí (Costs)

*   **Tổng Đầu vào** (`totalInput`):
    *   **Ý nghĩa:** Tiền gốc phải trả cho Nhà cung cấp để mua hàng hóa/dịch vụ (chưa VAT).
    *   **Công thức:** `Σ (Số lượng × Giá Đầu vào)`

*   **Chi phí Trực tiếp** (`totalDirectCosts`):
    *   **Ý nghĩa:** Tổng rổ chi phí trực tiếp của tất cả các mặt hàng.
    *   **Công thức:** `Σ (directCosts của từng item)`

*   **Chi phí Thực hiện (Chi phí quản lý/vận hành)** (`executionSum` hoặc `adminSum`):
    *   **Ý nghĩa:** Tổng các khoản mục thuê ngoài, công tác phí, chi phí khác để thực hiện xong hợp đồng.
    *   **Công thức:** `Σ (Số tiền của từng khoản mục trong executionCosts)`

*   **TỔNG CHI PHÍ** (`totalCosts`):
    *   **Ý nghĩa:** Tổng giá vốn hàng bán và mọi chi phí phát sinh.
    *   **Công thức:** `Tổng Đầu vào + Chi phí Trực tiếp + Chi phí Thực hiện`
    *   *(Lưu ý: Không lấy trừ Chiết khấu NCC ở đây trong logic code mới).*

---

### 2.3. Nhóm chỉ tiêu Lợi nhuận (Profitability)

Đây là các chỉ số sinh tử của Phương án kinh doanh:

*   **Lợi nhuận Gộp** (`grossProfit`):
    *   **Ý nghĩa:** Tiền lãi thực tế mà công ty thu về (trước thuế TNDN), được tính dựa trên **Doanh thu KHÔNG VAT**.
    *   **Công thức:** `Doanh thu (-VAT) - Tổng Chi phí`
    *   *Quy tắc chuẩn:* Không tính lợi nhuận gộp trên số tiền có VAT (Giá trị ký kết). VAT là thuế thu hộ Nhà nước.

*   **Tỷ suất Lợi nhuận** (`profitMargin` hoặc `margin`):
    *   **Ý nghĩa:** Cho biết cứ 100 đồng Doanh thu thì công ty lãi được bao nhiêu đồng.
    *   **Công thức:** `(Lợi nhuận Gộp / Doanh thu (-VAT)) × 100%`

---

## 3. Logic làm tròn số (Rounding)

Hệ thống ERP tuân thủ quy tắc làm tròn để tránh sai số hiển thị:

1.  **Tiền tệ (VNĐ):**
    *   Luôn làm tròn thành số nguyên (`Math.round()`).
    *   Khi tính toán `percentage` ra `amount` và ngược lại trong Chi phí thực hiện:
        *   Tìm Tiền từ %: `Tiền = Math.round((% / 100) * Doanh thu)`
        *   Tìm % từ Tiền: `% = Number(((Tiền / Doanh thu) * 100).toFixed(2))`
2.  **Tỷ suất %:**
    *   Hiển thị với 1 chữ số thập phân, VD: `53.6%`. (`margin.toFixed(1)`).
3.  **Tỷ giá ngoại tệ:**
    *   `VND = Ngoại tệ * Tỷ giá`. Tiền ngoại tệ có thể có phần thập phân (USD có cent), nhưng khi quy đổi ra VNĐ phải làm tròn thành số nguyên.

---

## 4. Ví dụ luồng tính toán toàn diện

Một ví dụ đầy thực tế từ một hợp đồng cung cấp Giải pháp BIM:

**A. Khai báo Sản phẩm**
1.  **Phần mềm Revit:** 5 License. Mua vào: 8tr/License, Bán ra: 12tr/License. VAT: 10%.
2.  **Dịch vụ Đào tạo:** 1 Gói. Mua vào (thuê chuyên gia): 5tr/gói, Bán ra: 15tr/gói. VAT: 10%. CP Trực tiếp (Tài liệu): 2tr.

**B. Khai báo Chi phí Thực hiện**
1.  **Công tác phí:** 3.000.000 đ
2.  **Khác:** 1.000.000 đ

**C. Hệ thống tính tự động:**
*   *Doanh thu (-VAT)* = (5 * 12tr) + (1 * 15tr) = 60tr + 15tr = **75.000.000 đ**
*   *Giá trị Ký kết* = 75tr * (1 + 10%) = **82.500.000 đ**

*   *Tổng Đầu vào* = (5 * 8tr) + (1 * 5tr) = 40tr + 5tr = **45.000.000 đ**
*   *Tổng CP Trực tiếp* = **2.000.000 đ**
*   *Tổng CP Thực hiện* = 3tr + 1tr = **4.000.000 đ**

*   **Tổng Chi phí** = 45tr + 2tr + 4tr = **51.000.000 đ**

*   **Lợi nhuận gộp** = Doanh thu - Tổng Chi phí = 75tr - 51tr = **24.000.000 đ**
*   **Tỷ suất LN (Margin)** = 24 / 75 = **32.0%**

---

## 5. Xử lý ngoại lệ (Edge Cases)

*   **Doanh thu bằng 0:** Nếu hợp đồng là hợp đồng chi phí thuần túy (Doanh thu = 0), công thức tính Margin sẽ sinh ra lỗi chia cho 0.
    *   *Xử lý:* Hệ thống bắt điều kiện `Phân bổ = Doanh thu > 0 ? (LN/DT)*100 : 0;` (Luôn trả về 0%).
*   **Âm lợi nhuận:** Giá trị LN Gộp hoàn toàn có thể là số âm (Lỗ). Trên giao diện sẽ render bằng màu Đỏ `text-rose-500` để cảnh báo User.
*   **VAT 0% hoặc không chịu thuế:** Hệ thống hỗ trợ VAT là một trường thay đổi linh hoạt cho từng hạng mục (`item.vatRate ?? 10`). Lập trình viên luôn phải để case back up nếu dữ liệu rỗng.

---
*(Tài liệu này là thông số gốc cho việc phát triển các module ContractForm, BusinessPlan, Invoice và Report của hệ thống).*
