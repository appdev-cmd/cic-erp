# 📊 TÀI LIỆU LOGIC TÍNH TOÁN TÀI CHÍNH - CIC ERP (PHIÊN BẢN ĐẦY ĐỦ)

> **Dự án:** CIC ERP - Quản lý Hợp đồng & KPI
> **Phiên bản tài liệu:** 2.0 | **Ngày cập nhật:** 01/03/2026

Tài liệu này bao gồm toàn bộ các định nghĩa, quy định, biến cố và logic xử lý số liệu tài chính thuộc module Hợp đồng và Phương án Kinh doanh (PAKD) của hệ thống CIC ERP. Tài liệu là kim chỉ nam cho việc phát triển các tính toán lợi nhuận, doanh thu và hiển thị Dashboard.

---

## 1. CÁC THÔNG SỐ VÀ ĐỊNH NGHĨA BIẾN MẶC ĐỊNH

| Thuật ngữ nghiệp vụ | Tên Biến (Mã Nguồn) | Định nghĩa & Tính chất |
| :--- | :--- | :--- |
| **Hạng mục Sản phẩm/Dịch vụ** | `LineItem` | Danh sách các sản phẩm cung cấp trong hợp đồng. Mỗi Line Item chứa thông tin: Tên, Số lượng, Đơn giá đầu vào, Đơn giá đầu ra, Thuế suất VAT, Chi phí trực tiếp. |
| **Giá Đầu vào (1 SP)** | `inputPrice` | Đơn giá nhập của 1 đơn vị sản phẩm từ Nhà Cung Cấp. (Giá gốc, Chưa gồm VAT). |
| **Giá Đầu ra (1 SP)** | `outputPrice` | Đơn giá bán 1 đơn vị sản phẩm cho Khách hàng. (Báo giá, Chưa gồm VAT). |
| **Số lượng** | `quantity` | Số lượng sản phẩm/dịch vụ của hạng mục tương ứng. |
| **Thuế suất VAT** | `vatRate` | Tỷ lệ phần trăm thuế GTGT áp dụng cho hạng mục (Thường là: 0%, 5%, 8%, 10%). Nếu không khai báo, mặc định hệ thống tự chọn là 10%. |
| **Chi phí Trực tiếp** | `directCosts` | Chi phí phát sinh gắn liền với 1 hạng mục sản phẩm cụ thể nhằm mục đích vận hành cho SP đó (VD: Phí vận chuyển thiết bị, phí làm CO/CQ). |
| **Chi phí Thực hiện (Chung)** | `executionCosts` | Nhóm chi phí dùng chung cho cả Hợp đồng, không gắn bó cụ thể vào 1 sản phẩm nào. VD: Tiền công tác phí, tiền quà cáp, tiền làm bảo lãnh thực hiện HĐ. |
| **Chiết khấu từ NCC** | `supplierDiscount` | Là số tiền Nhà Cung Cấp giảm giá hoặc trả lại (Rebate/Kick-back) cho CIC. Nguồn tiền này đi vào công ty như một sự gia tăng Lợi Nhuận. |

---

## 2. NHÓM CHỈ TIÊU DOANH THU VÀ DÒNG TIỀN

Nhóm này đo lường số tiền mà công ty CIC có thể mang về từ Hợp đồng. Chú ý phân biệt rõ giữa việc có VAT (Tiền mặt thực tế thu) và không có VAT (Doanh thu ghi nhận).

### 2.1. DOANH THU (CHƯA VAT)
**Ký hiệu Biến:** `estimatedRevenue` hoặc `revenue`
**Ý nghĩa:** Đây là chỉ số cốt lõi. Thuế VAT là phần công ty thu hộ Nhà Nước nên KHÔNG ĐƯỢC tính vào hiệu quả kinh doanh. Lợi nhuận gộp và KPI sẽ được tính dựa trên con số này.
**Công thức:** Tổng Đầu ra của tất cả hạng mục sản phẩm.
> Doanh thu = Σ (Số lượng × Giá Đầu ra)

### 2.2. GIÁ TRỊ KÝ KẾT (CÓ VAT)
**Ký hiệu Biến:** `signingValue`
**Ý nghĩa:** Là số tiền in trên mặt Giấy Phép / Hợp Đồng Ký Kết mà khách hàng có nghĩa vụ thanh toán chuyển khoản cho CIC.
**Đặc biệt về Chiết khấu:** Chiết khấu từ Nhà Cung Cấp (`supplierDiscount`) được hệ thống cộng ngược vào Giá trị Ký kết (với ý nghĩa đây là một khoản "tiền vào" bổ sung ngoài khách hàng trả).
**Công thức:** Tổng Đầu ra (Bao gồm VAT) của tất cả hạng mục + Tiền Chiết khấu NCC.
> Giá trị Ký kết = Σ [Số lượng × Giá Đầu ra × (1 + vatRate / 100)] + Chiết khấu NCC

---

## 3. NHÓM CHỈ TIÊU CHI PHÍ VÀ VỐN TÀI TRỢ

Nhóm này đo lường các khoản CIC phải chi trả để phục vụ Hợp đồng. Tất cả đều phải quy về mốc "Chưa VAT" khi tính vào chi phí.

### 3.1. TỔNG ĐẦU VÀO (GIÁ VỐN HÀNG BÁN)
**Ký hiệu Biến:** `totalInput`
**Ý nghĩa:** Tổng tiền dự đính chi để mua nguyên vật liệu, trả tiền bản quyền license từ các Hãng / Nhà Cung Cấp.
**Công thức:** Tổng Giá Đầu vào của tất cả hạng mục.
> Tổng Đầu vào = Σ (Số lượng × Giá Đầu vào)

### 3.2. TỔNG CHI PHÍ TRỰC TIẾP
**Ký hiệu Biến:** `totalDirectCosts`
**Ý nghĩa:** Cứ ứng với 1 cấu thành Sản Phẩm, ta phát sinh các chi phí trực tiếp đi kèm. Đây là mốc tính tổng chúng.
**Công thức:**
> Tổng CP Trực tiếp = Σ (directCosts của từng LineItem)

### 3.3. TỔNG CHI PHÍ THỰC HIỆN / QUẢN LÝ
**Ký hiệu Biến:** `executionSum` hoặc `adminSum`
**Ý nghĩa:** Các chi phí thực thi (Execution) do NVKD khai báo bổ sung.
**Công thức:** Bằng tổng số tiền của các khoản mục trong mảng Execution Costs.
> Tổng CP Thực hiện = Σ (amount của list executionCosts)

### 3.4. TỔNG CHI PHÍ HOẠT ĐỘNG
**Ký hiệu Biến:** `totalCosts`
**Ý nghĩa:** Đo lường tổng nguồn lực cần chi ra để đưa hợp đồng từ lúc ký kết đến lúc nghiệm thu.
**Công thức:** Tổng của 3 loại chi phí trên. Chiết khấu NCC không được cấn trừ vào đây.
> TỔNG CHI PHÍ = Tổng Đầu vào + Tổng CP Trực tiếp + Tổng CP Thực hiện

---

## 4. NHÓM CHỈ TIÊU LỢI NHUẬN VÀ HIỆU QUẢ (PROFITABILITY)

Nhóm chỉ tiêu quyết định Hợp đồng này có tốt không, NVKD có được chia thưởng KPI không. Việc tính toán luôn phải dựa trên phần DOANH THU CHƯA VAT.

### 4.1. LỢI NHUẬN GỘP (GROSS PROFIT)
**Ký hiệu Biến:** `grossProfit`
**Ý nghĩa:** Khác biệt giữa dòng tiền thu vào (Thuần/Chưa VAT) và tổng phần chi phí phải bỏ ra để thực hiện. Lợi nhuận trước chi phí văn phòng/thể chế (Tax, Interest).
**Công thức cốt lõi:**
> LỢI NHUẬN GỘP = Doanh thu (-VAT) - TỔNG CHI PHÍ

*Lưu ý: Nếu một HĐ có Lợi Nhuận Gộp mang dấu ÂM (-), nghĩa là Hợp đồng này lỗ, cần sự phê duyệt của Giám Đốc/Cấp Quản lý trước khi được chốt.*

### 4.2. TỶ SUẤT LỢI NHUẬN (PROFIT MARGIN)
**Ký hiệu Biến:** `profitMargin` hoặc `margin`
**Ý nghĩa:** Báo cáo năng suất sinh lời. Trong 100 Đồng Doanh thu sinh ra mang về được bao nhiêu Đồng Lãi?
**Công thức:**
> TỶ SUẤT LỢI NHUẬN = (Lợi nhuận Gộp / Doanh thu (-VAT)) × 100%

*Hệ thống yêu cầu trường Tỷ suất này phải hiển thị làm tròn ở 1 chữ số thập phân (Ví dụ: 12.5%). Nếu Doanh thu = 0, Margins được gắn cứng trả về = 0%.*

---

## 5. QUY DIỄN HOÁN ĐỔI GIỮA SỐ TIỀN VÀ PHẦN TRĂM (%)

Trong giao diện báo cáo Chi phí Thực hiện (Execution Costs), NVKD có thể nhập số tiền bằng VND hoặc nhập tỷ lệ %. Hệ thống sẽ tự động hoán đổi quy ngược thông số còn lại.

**Nguyên gốc đối chiếu:** Tổng Doanh thu (-VAT).

**Biến đổi 1: Từ [Số %] tìm -> [Số Tiền]**
Khi người dùng nhập: "Chi phí này chiếm % bao nhiêu".
> Số Tiền = Math.round(( Số_Phần_Trăm_Nhập / 100 ) × Doanh thu (-VAT))

**Biến đổi 2: Từ [Số Tiền] tìm -> [Số %]**
Khi người dùng nhập: "Chi phí này hết chừng này tiền VND".
> Số % = (( Số_Tiền_Nhập / Doanh thu (-VAT) ) × 100).toFixed(2)

---

## 6. VÍ DỤ TÍNH TOÁN (END-TO-END SCENARIO)

Bạn là NVKD đang cấu hình cho PAKD hợp đồng: "Cung cấp phần mềm Revit và tư vấn chuẩn BIM".

**Bước 1: Khai báo Danh mục Hàng Hóa (Line Items)**
- (1) **Phần mềm Revit:** Bán 5 bộ. Mua hãng: 8.000.000 đ/bộ. Bán KH: 12.000.000 đ/bộ. Áp dụng VAT: 10%.
- (2) **Dịch vụ Đào tạo:** Bán 1 Khóa. Trả thù lao Chuyên gia: 5.000.000 đ. Bán KH: 15.000.000 đ. Thuê địa điểm (Trực tiếp cấp cho Khóa này): 2.000.000 đ. Áp dụng VAT: 0% (Dịch vụ đặc thù).

**Bước 2: Khai báo Chi phí Thực Hiện (Execution Costs)**
- Tiền công tác phí (Bay vào HCM): 3.000.000 đ.
- Tiền quà cáp Đối tác: 1.000.000 đ.

**Bước 3: Khai báo Chiết khấu (Supplier Discount)**
- Hãng Autodesk thưởng Kick-back 1.500.000 đ.

---
**HỆ THỐNG BACKGROUND CHẠY RA CÁC KẾT QUẢ SAU:**

**1. Chỉ số DOANH THU:**
*   Doanh thu (Revit) = 5 × 12tr = 60.000.000 đ
*   Doanh thu (Đào tạo) = 1 × 15tr = 15.000.000 đ
=> **DOANH THU (-VAT)** = 60tr + 15tr = **75.000.000 đ**

**2. Chỉ số KÝ KẾT (CÓ VAT):**
*   (Revit) = 60.000.000 × (1 + 10%) = 66.000.000 đ
*   (Đào tạo) = 15.000.000 × (1 + 0%) = 15.000.000 đ
*   (Kick-back) = 1.500.000 đ
=> **GIÁ TRỊ KÝ KẾT** = 66tr + 15tr + 1.5tr = **82.500.000 đ**

**3. Chỉ số CHI PHÍ:**
*   Tổng Đầu vào (Revit + Đạo tạo) = (5 × 8tr) + (1 × 5tr) = 45.000.000 đ
*   Tổng CP Trực Tiếp (Thuê địa điểm) = 2.000.000 đ
*   Tổng CP Thực hiện (Công tác + Quà) = 3tr + 1tr = 4.000.000 đ
=> **TỔNG CHI PHÍ** = 45tr + 2tr + 4tr = **51.000.000 đ**

**4. Chỉ số LỢI NHUẬN:**
=> **LỢI NHUẬN GỘP** = `DOANH THU (-VAT)` - `TỔNG CHI PHÍ` = 75.000.000 đ - 51.000.000 đ = **24.000.000 đ**
=> **TỶ SUẤT LỢI NHUẬN (MARGIN)** = (24.000.000 / 75.000.000) × 100% = **32.0%**

---

> Các Logic tính toán trên đã được cố định cấu trúc vào các Controller và Hook React (`useContractCalculations.ts`). Nghiêm cấm mọi tự ý thay đổi logic trừ khi có văn bản yêu cầu từ Ban Giám Đốc.
