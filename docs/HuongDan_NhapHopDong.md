# 📋 HƯỚNG DẪN NHẬP HỢP ĐỒNG - CIC ERP

> **Phiên bản:** 1.0 | **Cập nhật:** 26/02/2026  
> **Hệ thống:** CIC ERP - Quản lý Hợp đồng & KPI

---

## Mục lục

1. [Tổng quan](#1-tổng-quan)
2. [Nhập hợp đồng thủ công (Form 3 bước)](#2-nhập-hợp-đồng-thủ-công)
3. [Import hàng loạt từ Excel](#3-import-hàng-loạt-từ-excel)
4. [Import từ file PAKD](#4-import-từ-file-pakd)
5. [Các trường dữ liệu chi tiết](#5-các-trường-dữ-liệu-chi-tiết)
6. [Công thức tính toán tài chính](#6-công-thức-tính-toán-tài-chính)
7. [Mẹo sử dụng & Xử lý lỗi](#7-mẹo-sử-dụng--xử-lý-lỗi)

---

## 1. Tổng quan

Hệ thống CIC ERP hỗ trợ **3 phương thức** nhập hợp đồng:

| Phương thức | Mô tả | Khi nào dùng |
|---|---|---|
| **Form thủ công** | Form wizard 3 bước, nhập chi tiết từng hợp đồng | Hợp đồng mới, cần nhập đầy đủ chi tiết |
| **Import Excel** | Upload file `.xlsx` với danh sách nhiều hợp đồng | Nhập hàng loạt từ dữ liệu Excel có sẵn |
| **Import PAKD** | Import từ file Phương án Kinh doanh (PAKD) | Khi đã có file PAKD chuẩn, tự động tạo sản phẩm & chi phí |

### Quyền truy cập

| Vai trò | Quyền nhập HĐ |
|---|---|
| Admin, Leadership | ✅ Toàn quyền |
| AdminUnit, UnitLeader | ✅ Tạo mới, chỉnh sửa, xóa |
| NVKD | ✅ Tạo mới, chỉnh sửa (không xóa) |
| Accountant, ChiefAccountant, Legal | ❌ Chỉ xem |

---

## 2. Nhập hợp đồng thủ công

### Cách mở form nhập

1. Trên thanh sidebar trái, chọn **Hợp đồng**
2. Nhấn nút **"+ Thêm mới"** ở góc trên bên phải danh sách
3. Form **"Khai báo hồ sơ hợp đồng"** sẽ mở ra

### Form gồm 3 bước (Wizard)

```
┌──────────────────┐    ┌──────────────────────┐    ┌──────────────────────┐
│  BƯỚC 1           │ → │  BƯỚC 2               │ → │  BƯỚC 3               │
│  Đơn vị & Nhân sự│    │  Phương án Kinh doanh │    │  Doanh thu & Tiền về  │
│  + Khách hàng     │    │  + Chi phí thực hiện   │    │  + Thanh toán NCC     │
└──────────────────┘    └──────────────────────┘    └──────────────────────┘
```

---

### 📌 BƯỚC 1: Đơn vị & Nhân sự + Khách hàng

#### 1.1 Đơn vị & Nhân sự thực hiện

| Trường | Bắt buộc | Mô tả |
|---|:---:|---|
| **Đơn vị thực hiện** | ✅ | Chọn đơn vị kinh doanh phụ trách (Chi nhánh/Trung tâm). Không hiển thị đơn vị BackOffice |
| **Nhân viên thực hiện** | ✅ | Danh sách nhân viên lọc theo đơn vị đã chọn |
| **Tỷ lệ %** | Tự động | Hiển thị % phân bổ còn lại (100% trừ đi phần phối hợp) |

> **Lưu ý:** Khi thay đổi đơn vị, nhân viên sẽ được reset. Hãy chọn lại nhân viên sau khi đổi đơn vị.

#### 1.2 Phân bổ đơn vị phối hợp (QĐ 09.2024)

Nếu hợp đồng có **nhiều đơn vị cùng tham gia**, bạn có thể thêm đơn vị phối hợp:

1. Nhấn nút **"+ Thêm đơn vị phối hợp"** trong mục Unit Allocations
2. Chọn đơn vị hỗ trợ (Support)
3. Nhập **% phân bổ** cho đơn vị đó
4. Chọn nhân viên phụ trách từ đơn vị phối hợp

> **Quy tắc:** Tổng % của đơn vị chính + đơn vị phối hợp = 100%. Phần trăm KPI sẽ được phân bổ theo tỷ lệ này.

#### 1.3 Thông tin Khách hàng & Nội dung

| Trường | Bắt buộc | Mô tả |
|---|:---:|---|
| **Số hợp đồng (ID)** | Tự tạo | Format: `HĐ_001/BIM_FECON_2026`. Có thể chỉnh sửa thủ công |
| **Tên khách hàng** | ✅ | Tìm kiếm khách hàng bằng ô tìm kiếm. Nhấn `+ Thêm khách hàng mới` nếu chưa có |
| **Ngày ký kết** | ✅ | Mặc định ngày hiện tại, có thể thay đổi |
| **Nội dung hợp đồng** | Nên nhập | Mô tả tóm tắt nội dung hợp đồng |
| **Có VAT** | Tùy chọn | Mặc định: Có VAT 10%. Có thể chọn 8% hoặc tắt VAT |
| **Bán qua đại lý** | Tùy chọn | Nếu tích, cần nhập thêm "Người dùng cuối (End User)" |

**Cách tạo Số hợp đồng tự động:**
- Hệ thống tự sinh theo format: `HĐ_[STT]/[Mã đơn vị]_[Viết tắt KH]_[Năm]`
- VD: `HĐ_001/BIM_FECON_2026`
- Nếu muốn tự nhập, chỉ cần gõ vào ô → hệ thống sẽ ngừng tự sinh

#### 1.4 Đầu mối liên hệ phía Khách hàng

Thêm một hoặc nhiều đầu mối liên hệ:

| Trường | Mô tả |
|---|---|
| **Họ tên** | Tên người đại diện phía khách hàng |
| **Vai trò** | VD: Mua sắm, Kế toán, Kỹ thuật, Giám đốc dự án |

- Nhấn **"+ Thêm đầu mối"** để thêm dòng mới
- Nhấn 🗑️ để xóa (tối thiểu phải có 1 đầu mối)

#### ➡️ Nhấn "Tiếp tục" để sang Bước 2

> ⚠️ **Hệ thống sẽ yêu cầu chọn Đơn vị và Nhân viên** trước khi cho phép tiếp tục.

---

### 📌 BƯỚC 2: Phương án Kinh doanh

Bước này nhập chi tiết sản phẩm/dịch vụ và các loại chi phí. **Thanh Tóm tắt Tài chính** sẽ hiển thị phía trên để bạn theo dõi real-time.

#### 2.1 Chi tiết Sản phẩm & Dịch vụ

Bảng nhập chi tiết hạng mục cung cấp:

| Cột | Mô tả | Ghi chú |
|---|---|---|
| **Sản phẩm/Dịch vụ** | Dropdown chọn từ danh mục sản phẩm | Giá đầu vào/ra tự điền khi chọn |
| **SL** | Số lượng | Mặc định: 1 |
| **Nhà cung cấp** | Dropdown chọn NCC | Chỉ hiển thị khách hàng loại Supplier/Both |
| **Giá Đầu vào** | Giá mua vào (1 đơn vị) | Nhập bằng VND |
| **TT Đầu vào** | = SL × Giá Đầu vào | Tự động tính |
| **Giá Đầu ra** | Giá bán ra (1 đơn vị) | Nhập bằng VND |
| **TT Đầu ra** | = SL × Giá Đầu ra | Tự động tính |
| **CP Trực tiếp** | Chi phí trực tiếp cho hạng mục | Click để mở popup nhập chi tiết |
| **Chênh lệch** | = TT Đầu ra - TT Đầu vào - CP Trực tiếp | Tự động tính, hiển thị xanh/đỏ |

**Thao tác:**
- **Thêm hạng mục:** Nhấn `+ Thêm hạng mục`
- **Xóa hạng mục:** Nhấn 🗑️ ở cuối dòng (tối thiểu 1 hạng mục)
- **Nhập chi phí trực tiếp:** Click vào ô `CP Trực tiếp` → mở Modal chi tiết → thêm từng khoản (VD: Tiếp khách, Vận chuyển, Thuế nhà thầu...)

**Hỗ trợ ngoại tệ:**
- Nếu import từ PAKD có ngoại tệ, hover vào ô "Giá Đầu vào" sẽ hiển thị tooltip:
  - 💱 Đơn giá ngoại tệ (ví dụ: 3,136.50 USD)
  - 📊 Tỷ giá (ví dụ: 26,500 VNĐ/USD)

#### 2.2 Chi phí thực hiện hợp đồng

Quản lý chi phí thực hiện dạng danh sách linh hoạt:

| Trường | Mô tả |
|---|---|
| **Hạng mục** | Tên chi phí (VD: Phí chuyển tiền, Thuê giảng viên...). Có gợi ý tự động |
| **%** | Tỷ lệ phần trăm tính trên tổng đầu vào. Khi nhập % → số tiền tự cập nhật |
| **Số tiền** | Nhập trực tiếp số tiền VND. Khi nhập tiền → % tự cập nhật |

- Nhấn **"+ Thêm hạng mục"** để thêm chi phí mới
- Có thể nhập % hoặc số tiền, hệ thống sẽ tính ngược cho trường còn lại

#### 2.3 Chiết khấu từ Nhà cung cấp

- Nhập **% chiết khấu** từ nhà cung cấp
- Hệ thống tự tính: `Số tiền chiết khấu = Tổng đầu vào × %`
- Chiết khấu này sẽ **GIẢM tổng chi phí** (có lợi cho doanh nghiệp)

#### ➡️ Nhấn "Tiếp tục" để sang Bước 3

---

### 📌 BƯỚC 3: Kế hoạch Doanh thu & Tiền về

#### 3.1 Lịch xuất Hóa đơn Doanh thu

Lập kế hoạch các đợt xuất hóa đơn:

| Trường | Mô tả |
|---|---|
| **Ngày XHĐ** | Ngày dự kiến xuất hóa đơn |
| **Giai đoạn** | Mô tả đợt (VD: "Đợt 1 - Tạm ứng", "Đợt 2 - Nghiệm thu") |
| **Tiền (VAT)** | Số tiền bao gồm VAT |

#### 3.2 Kế hoạch Tiền về (Từ Khách hàng)

Lập kế hoạch thu tiền từ khách hàng:

| Trường | Mô tả |
|---|---|
| **Ngày thanh toán** | Ngày dự kiến thu tiền |
| **Nội dung** | Mô tả đợt thu (VD: "Tạm ứng 30%", "Thanh toán nghiệm thu") |
| **Số tiền** | Số tiền dự kiến thu |

#### 3.3 Kế hoạch Chi trả Nhà cung cấp

Lập kế hoạch thanh toán cho NCC:

| Trường | Mô tả |
|---|---|
| **Hạn thanh toán** | Ngày hạn trả NCC |
| **Nhà cung cấp / Nội dung** | Tên NCC hoặc mô tả khoản chi |
| **Số tiền chi** | Số tiền phải trả NCC |

> **💡 Mẹo:** Nhấn nút **"Tự động tính từ SP"** để hệ thống tự tạo lịch thanh toán NCC từ thông tin sản phẩm đã nhập ở Bước 2.

#### ✅ Nhấn "Hoàn tất & Lưu" để tạo hợp đồng

---

## 3. Import hàng loạt từ Excel

### Cách thực hiện

1. Trong danh sách hợp đồng, nhấn nút **"Import"** (📥)
2. Trong popup Import, nhấn **"Tải file Template mẫu"** để tải file Excel mẫu
3. Điền dữ liệu vào file Template theo hướng dẫn bên dưới
4. **Kéo thả** file vào vùng upload hoặc nhấn **"Chọn file"**
5. Hệ thống sẽ đọc và **hiển thị preview** dữ liệu
6. Kiểm tra trạng thái từng dòng (✅ hợp lệ / ⚠️ lỗi)
7. Nhấn **"Import N hợp đồng"** để import các dòng hợp lệ

### Cấu trúc file Template (12 cột)

| Cột | Tên cột | Bắt buộc | Mô tả | Ví dụ |
|:---:|---|:---:|---|---|
| A | **Tên hợp đồng** | ✅ | Tiêu đề hợp đồng, không được trùng | HĐ Tư vấn dự án ABC |
| B | **Loại HĐ** | ✅ | `HĐ`, `HĐNT`, `HĐPS`, hoặc `PL` | HĐ |
| C | **Khách hàng** | ✅ | Tên khách hàng (phải khớp trong hệ thống) | Công ty ABC |
| D | **Mã đơn vị** | ✅ | Mã đơn vị (phải khớp trong hệ thống) | BIM |
| E | **NVKD** | Nên có | Tên nhân viên kinh doanh | Nguyễn Văn A |
| F | **Giá trị** | ✅ | Giá trị hợp đồng (số) | 500000000 |
| G | **Chi phí DK** | Nên có | Chi phí dự kiến (số) | 350000000 |
| H | **Ngày ký** | ✅ | Ngày ký hợp đồng (YYYY-MM-DD hoặc DD/MM/YYYY) | 2024-01-15 |
| I | **Ngày BĐ** | Tùy chọn | Ngày bắt đầu thực hiện | 2024-01-20 |
| J | **Ngày KT** | Tùy chọn | Ngày kết thúc | 2024-06-30 |
| K | **Trạng thái** | Tùy chọn | Active, Pending, Completed, Expired | Active |
| L | **Loại** | Tùy chọn | Mới, Tiếp nối, Phát sinh, Bảo hành | Mới |

### Quy tắc validate

| Quy tắc | Mô tả |
|---|---|
| Tên HĐ trống | ❌ Lỗi - phải có tên |
| Tên HĐ trùng trong file | ❌ Lỗi - không được trùng |
| Đơn vị không tồn tại | ❌ Lỗi - mã đơn vị phải khớp với hệ thống |
| Khách hàng không tồn tại | ❌ Lỗi - tên KH phải khớp với hệ thống |
| NVKD không tồn tại | ❌ Lỗi - tên NV phải khớp với hệ thống |
| Giá trị âm hoặc không hợp lệ | ❌ Lỗi - phải là số dương |
| Trạng thái không nhận dạng | ⚠️ Mặc định: Pending |

### Hỗ trợ tiếng Việt

Cột **Trạng thái** nhận diện cả tiếng Việt:
- "Hiệu lực" → Active
- "Chờ" → Pending  
- "Hoàn thành" → Completed
- "Hủy" / "Hết hạn" → Expired

---

## 4. Import từ file PAKD

### Mô tả

PAKD (Phương Án Kinh Doanh) là file Excel chuẩn nội bộ CIC, chứa đầy đủ thông tin sản phẩm, chi phí, chiết khấu NCC. Khi import PAKD, hệ thống sẽ:

- ✅ Tự động **tạo sản phẩm** mới nếu chưa tồn tại trong danh mục
- ✅ Tự động **tạo nhà cung cấp** mới nếu chưa tồn tại
- ✅ Import chi tiết hạng mục (số lượng, giá đầu vào/ra, chi phí trực tiếp)
- ✅ Import chi phí thực hiện hợp đồng (phí chuyển tiền, thuê chuyên gia...)
- ✅ Tính chiết khấu NCC từ số tiền sang tỷ lệ %
- ✅ Import thông tin ngoại tệ (nếu có)

### Cách import

1. Trong form tạo/sửa hợp đồng, ở **Bước 2** → nhấn nút **"Import PAKD"**
2. Chọn file PAKD (`.xlsx`)
3. Hệ thống sẽ tự động đọc và điền vào:
   - Bảng sản phẩm/dịch vụ
   - Chi phí thực hiện hợp đồng
   - Chiết khấu nhà cung cấp
4. Kiểm tra lại dữ liệu và chỉnh sửa nếu cần

> ⚠️ **Import PAKD sẽ GHI ĐÈ** dữ liệu sản phẩm & chi phí hiện tại trong form.

---

## 5. Các trường dữ liệu chi tiết

### Loại hợp đồng

| Mã | Tên đầy đủ |
|---|---|
| `HĐ` | Hợp đồng thường |
| `VV` | Văn vụ |

### Trạng thái hợp đồng

| Trạng thái | Mô tả |
|---|---|
| **Pending** | Chờ xử lý (mới tạo) |
| **Reviewing** | Đang xem xét / duyệt |
| **Active** | Đang hiệu lực |
| **Completed** | Đã hoàn thành |
| **Expired** | Hết hạn |
| **Terminated** | Đã chấm dứt |

### Giai đoạn thực hiện

| Giai đoạn | Mô tả |
|---|---|
| Signed | Đã ký |
| Advanced | Đã tạm ứng |
| Guaranteed | Đã bảo lãnh |
| InputOrdered | Đã đặt hàng đầu vào |
| Implementation | Đang thực hiện |
| Invoiced | Đã xuất hóa đơn |
| Completed | Đã hoàn thành |

---

## 6. Công thức tính toán tài chính

Hệ thống tự động tính toán real-time khi bạn nhập dữ liệu:

### Các chỉ số chính

```
Giá trị Ký kết = Σ (Số lượng × Giá Đầu ra × (1 + % VAT)) + Chiết khấu NCC

Doanh thu (-VAT) / Doanh thu dự kiến = Σ (Số lượng × Giá Đầu ra)

Tổng Đầu vào = Σ (Số lượng × Giá Đầu vào) cho mỗi hạng mục

Chi phí Trực tiếp = Σ Chi phí trực tiếp của từng hạng mục

Chi phí Thực hiện = Σ Các chi phí thực hiện HĐ (Công tác phí, Tiếp khách, Khác...)

Tổng Chi phí = Tổng Đầu vào + Chi phí Thực hiện + Chi phí Trực tiếp

Lợi nhuận Gộp = Doanh thu (-VAT) - Tổng Chi phí

Tỷ suất LN = (Lợi nhuận Gộp / Doanh thu (-VAT)) × 100%
```

### Ví dụ minh họa

> **Giả sử:** Tất cả sản phẩm có VAT 10%. Giao dịch không có Chiết khấu NCC.

| Hạng mục | SL | Giá vào | Giá ra (-VAT) | CP TT |
|---|:---:|---:|---:|---:|
| Phần mềm Revit | 5 | 8,000,000 | 12,000,000 | 0 |
| Đào tạo BIM | 2 | 5,000,000 | 15,000,000 | 10,000,000 |
| Tư vấn BEP | 1 | 0 | 50,000,000 | 0 |

```
Doanh thu (-VAT)= (5×12M) + (2×15M) + (1×50M) = 140,000,000
Giá trị Ký kết  = 140M × (1 + 10%) = 154,000,000
Tổng Đầu vào    = (5×8M) + (2×5M) + 0 = 50,000,000
CP Trực tiếp    = 0 + 10,000,000 + 0 = 10,000,000
CP Thực hiện    = 5,000,000 (Ví dụ: Công tác phí)

Tổng Chi phí    = 50M + 10M + 5M = 65,000,000
Lợi nhuận Gộp   = 140M - 65M = 75,000,000
Tỷ suất LN      = 75M / 140M = 53.6%
```

---

## 7. Mẹo sử dụng & Xử lý lỗi

### 💡 Mẹo hữu ích

| Mẹo | Chi tiết |
|---|---|
| **Tự lưu bản nháp** | Hệ thống tự lưu nháp mỗi 1 giây. Nếu thoát giữa chừng, lần sau mở form sẽ hỏi "Khôi phục bản nháp?" |
| **Dữ liệu mẫu** | Nhấn nút **"Data Mẫu"** (góc trên phải) để điền tất cả trường với dữ liệu mẫu. Hữu ích khi làm test |
| **Nhân bản HĐ** | Từ danh sách, nhấn nút Clone trên một HĐ có sẵn → Form mở với dữ liệu copy, chỉ cần chỉnh sửa |
| **Thêm KH nhanh** | Nhấn `+ Thêm khách hàng mới` ngay trong ô tìm kiếm khách hàng, không cần thoát form |
| **Tự tạo lịch NCC** | Ở Bước 3, nhấn "Tự động tính từ SP" để hệ thống tạo lịch thanh toán NCC dựa trên sản phẩm |
| **Phím tắt tìm kiếm** | Trong danh sách HĐ: nhấn **/** để focus vào ô tìm kiếm, **Escape** để cancel |

### ⚠️ Lỗi thường gặp và cách xử lý

| Lỗi | Nguyên nhân | Cách khắc phục |
|---|---|---|
| "Vui lòng chọn Đơn vị và Nhân viên" | Chưa chọn đơn vị hoặc nhân viên ở Bước 1 | Quay lại Bước 1, chọn đầy đủ |
| "Vui lòng nhập đầy đủ thông tin bắt buộc" | Thiếu Đơn vị, Sale, hoặc Khách hàng | Điền đầy đủ các trường bắt buộc (✅) |
| Khách hàng không tìm thấy (Import) | Tên KH trong Excel không khớp hệ thống | Kiểm tra chính tả, hoặc thêm KH vào hệ thống trước |
| Đơn vị không tồn tại (Import) | Mã đơn vị sai | Dùng đúng mã: BIM, PMXD, CSS, DCS, HCM, HN |
| Ngày không hợp lệ (Import) | Sai format ngày | Dùng format: YYYY-MM-DD hoặc DD/MM/YYYY |
| Giá trị không hợp lệ (Import) | Cột Giá trị có text hoặc ký tự đặc biệt | Chỉ nhập số, không có dấu chấm phẩy hoặc ký tự |

### 📞 Liên hệ hỗ trợ

Nếu gặp vấn đề ngoài danh sách trên, liên hệ:
- **Quản trị hệ thống** (Admin) để kiểm tra dữ liệu danh mục
- **Phòng CNTT** để xử lý lỗi kỹ thuật

---

> 📝 *Tài liệu này được tạo tự động dựa trên phân tích mã nguồn hệ thống CIC ERP v2026. Vui lòng liên hệ team phát triển nếu có thay đổi tính năng.*
