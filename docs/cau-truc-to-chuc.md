# Cấu trúc Tổ chức Công ty CIC

## 1. Sơ đồ Tổ chức
```
Ban Giám đốc
├── Phòng Kinh doanh 1 (KD1)
├── Phòng Kinh doanh 2 (KD2)
├── Phòng Kỹ thuật (KT)
├── Phòng Tài chính - Kế toán (TCKT)
├── Phòng Hành chính - Nhân sự (HCNS)
├── Phòng Pháp chế (PC)
└── Ban Quản lý Dự án (QLDA)
```

## 2. Phân quyền trên ERP
### Vai trò (Roles)
| Vai trò | Quyền hạn |
|---------|-----------|
| Admin | Toàn quyền hệ thống, quản lý users |
| Director | Xem toàn bộ, duyệt hợp đồng lớn |
| Manager | Quản lý hợp đồng của đơn vị mình |
| Staff | Xem và tạo hợp đồng được giao |
| Viewer | Chỉ xem dữ liệu |

### Quy tắc truy cập dữ liệu
- Nhân viên chỉ thấy hợp đồng thuộc đơn vị mình (hoặc được giao)
- Manager thấy tất cả hợp đồng của đơn vị
- Director và Admin thấy toàn bộ dữ liệu
- Dữ liệu nhạy cảm (lương, đánh giá) chỉ HCNS và Admin

## 3. Đơn vị Phụ trách
- Mỗi hợp đồng được gán cho 1 đơn vị chính
- Có thể có đơn vị phối hợp
- KPI đơn vị = Tổng giá trị HĐ + Tỷ lệ thu tiền + Tiến độ

## 4. Nhân sự Chủ chốt
- Mỗi hợp đồng có 1 "Cán bộ phụ trách" (người theo dõi chính)
- Manager phân công task cho nhân viên
- Đánh giá hiệu suất dựa trên: số HĐ phụ trách, giá trị, tỷ lệ hoàn thành
