# Kế hoạch thiết kế: Xuất Báo cáo Quản trị ra PDF chuyên nghiệp

> Phạm vi: nút **"Xuất báo cáo"** trên trang Báo cáo Quản trị (BI) — `components/Analytics.tsx:2996` (hiện chưa có `onClick`).
> Ngày lập: 11/06/2026

---

## 1. Hiện trạng & tài sản sẵn có

| Hạng mục | Hiện trạng |
|---|---|
| Nút Xuất báo cáo | Đã có UI (màu cam, icon Download) nhưng **chưa gắn hành vi** |
| Thư viện PDF | Đã cài `jspdf@4`, `jspdf-autotable@5`, `html-to-image`, `html2canvas`, `html2pdf.js` |
| Pattern PDF tiếng Việt | Đã có `utils/businessPlanPdf.ts` (PAKD): nhúng font Roboto từ `public/fonts/Roboto-Regular.ttf`, autoTable, lưu file qua `showSaveFilePicker` |
| Logo | `public/cic-logo.png`, `public/cic-logo-full.png` |
| Dữ liệu | ~30 `useMemo` dataset trong `Analytics.tsx` (kpiData, monthlyTrendData, cashflowData, arAgingData, topBrandsData, …) |
| Registry card | `components/analytics/cardRegistry.ts` — 29 card / 4 tab, có phân quyền theo role (`sensitivity: general/profit`) + cá nhân hoá (visible/order) |
| Ràng buộc render | **Chỉ tab đang active mới mount card** (`Analytics.tsx:3069-3072`) → không thể chụp chart của tab khác trực tiếp từ DOM |

## 2. Lựa chọn kiến trúc xuất PDF

### Phương án so sánh

| Phương án | Ưu | Nhược | Kết luận |
|---|---|---|---|
| A. `html2pdf.js`/`html2canvas` chụp nguyên trang | Nhanh, ít code | Chữ thành ảnh (mờ khi in), vỡ trang tuỳ tiện, dính dark-mode, file nặng | ❌ Loại — không đạt chuẩn doanh nghiệp |
| B. jsPDF thuần vector (vẽ lại chart bằng jsPDF) | Sắc nét tuyệt đối, file nhẹ | Vẽ lại ~20 chart Recharts bằng tay = chi phí rất lớn, khó bảo trì | ❌ Quá đắt |
| **C. Hybrid (đề xuất)**: jsPDF vector cho khung/chữ/bảng + chụp từng chart Recharts thành PNG @2x nhúng vào | Text/bảng vector sắc nét, chart giữ đúng hình ảnh người dùng quen thuộc, tận dụng pattern PAKD sẵn có | Phải render "print layout" ẩn để có đủ chart của 4 tab | ✅ Chọn |

### Cơ chế chụp chart (giải quyết ràng buộc chỉ-tab-active)

Render một **`ReportPrintLayout`** ẩn (off-screen: `position:fixed; left:-10000px; width:794px`, ép class `light`) chứa **toàn bộ card visible của cả 4 tab** với cùng dataset đang hiển thị. Sau khi mount + chart vẽ xong (đợi 2 frame + timeout an toàn), dùng `html-to-image.toPng(node, { pixelRatio: 2, backgroundColor: '#ffffff' })` chụp từng card theo `data-card-id`. Cách này đồng thời giải quyết:
- Dark mode: layout ẩn luôn ép nền sáng → PDF luôn nền trắng chuẩn in ấn.
- Responsive: chiều rộng cố định 794px (~A4 dọc 96dpi) → chart không phụ thuộc kích thước màn hình người dùng.

## 3. Thiết kế bản báo cáo (cấu trúc tài liệu)

**Khổ giấy: A4 dọc (portrait)**, lề 15mm trái/phải, 20mm trên/dưới. Font Roboto (Regular + **bổ sung Roboto-Bold.ttf** vào `public/fonts/` cho tiêu đề — hiện chỉ có Regular).

### 3.1. Trang bìa (trang 1)
- Logo `cic-logo-full.png` căn giữa trên.
- Tiêu đề lớn: **BÁO CÁO QUẢN TRỊ KINH DOANH** (navy `#1e3a8a`, 24pt bold).
- Dòng kỳ báo cáo: `Năm 2026 · Quý II` (theo `yearFilter`/`periodFilter` đang chọn).
- Khối thông tin phạm vi (bảng 2 cột không viền):
  - Đơn vị: *(tên unit đang chọn / "Toàn công ty")*
  - Phạm vi lọc: Hãng / Sản phẩm / Khách hàng đang filter (nếu có — minh bạch dữ liệu)
  - Người xuất: tên user đăng nhập
  - Thời điểm xuất: `dd/MM/yyyy HH:mm`
- Chân trang bìa: dòng cảnh báo **"TÀI LIỆU LƯU HÀNH NỘI BỘ"** (đỏ gạch, 9pt) — vì báo cáo chứa lợi nhuận.

### 3.2. Header/Footer mọi trang nội dung
- Header: logo nhỏ trái + "Báo cáo Quản trị Kinh doanh — Năm 2026" phải, gạch chân mảnh navy.
- Footer: trái "CIC ERP · Lưu hành nội bộ", giữa ngày xuất, phải **"Trang x/y"** (đánh số sau cùng bằng `doc.getNumberOfPages()`).

### 3.3. Phần I — Tóm tắt điều hành (Executive Summary)
- Bảng KPI 5 chỉ tiêu (từ `kpiData`/`statsData`): **Ký kết · Doanh thu · LN quản trị · LN theo DT · Tiền về**.
  - Cột: Chỉ tiêu | Thực hiện | Kế hoạch năm | % hoàn thành | So cùng kỳ (YoY).
  - % hoàn thành tô màu trạng thái: ≥100% xanh, 70–99% cam, <70% đỏ (chỉ tô ô %, giữ tổng thể trang nhã).
- 3–5 dòng nhận xét tự động (rule-based, không cần AI ở phase 1): "Doanh thu đạt X% kế hoạch, cao/thấp hơn cùng kỳ Y%…".

### 3.4. Phần II–V — theo 4 tab hiện hữu (mỗi phần bắt đầu trang mới)
| Phần | Nguồn tab | Nội dung |
|---|---|---|
| II. Tổng quan & Doanh thu | `overview` | Chart: Cơ cấu DT, KH vs Thực tế, Xu hướng tháng, Lũy kế vs Mục tiêu, So sánh cùng kỳ + **bảng số liệu tháng** (12 cột) dưới chart xu hướng |
| III. Dòng tiền & Thanh toán | `cashflow` | Chart Thu–Chi, Lũy kế; **bảng AR aging** + **bảng Top HĐ tồn đọng công nợ** (bảng ưu tiên hơn chart vì là dữ liệu hành động) |
| IV. Sản phẩm & Đối tác | `product_brand` | Chart Top Hãng, Nhóm SP, Pareto; bảng Top 10 hãng (DT, % đóng góp, biên LN nếu được quyền) |
| V. Hiệu suất & Khách hàng | `employee_customer` | Bảng Top KH, Top NV, Hiệu suất đơn vị (Thực tế/Chỉ tiêu/%), KPI nhân sự; chart phân bố quy mô HĐ |

Nguyên tắc trình bày từng phần:
- Tiêu đề phần: thanh navy + số La Mã, 13pt bold trắng.
- Mỗi card = 1 khối: tiêu đề card (11pt bold) + subtitle (8pt xám) + ảnh chart (max-width content, giữ tỷ lệ) hoặc bảng autoTable.
- Chống mồ côi: nếu khối không đủ chỗ (>70% đã dùng trang) → sang trang mới, không cắt đôi chart.
- Bảng: theme `striped` nhẹ (header navy chữ trắng, hàng chẵn `#f8fafc`), số căn phải, định dạng `vi-VN` (1.234.567), giá trị lớn kèm đơn vị "triệu ₫"/"tỷ ₫" thống nhất theo `formatCurrencyGlobal`.

### 3.5. Trang cuối — Phê duyệt
- 2 ô ký: "Người lập báo cáo" (tên user) | "Lãnh đạo phê duyệt" — cách 25mm cho chữ ký.

## 4. Tôn trọng phân quyền & cá nhân hoá (bắt buộc)

- Chỉ đưa vào PDF các card thuộc `visibleOrderedIds` (giao của quyền role ∩ lựa chọn user) — **báo cáo in ra không được lộ card mà UI đang ẩn theo role** (đặc biệt `sensitivity: 'profit'`: LNG, biên LN, ma trận BCG…).
- KPI strip: nếu user không có quyền card `kpi-summary` → Phần I chỉ hiện các chỉ tiêu general (Ký kết, Doanh thu, Tiền về).
- Thứ tự card trong từng phần theo đúng thứ tự user đã sắp xếp.

## 5. Hộp thoại tuỳ chọn xuất (ExportReportDialog)

Bấm nút → mở modal nhỏ (theo pattern SlidePanel/modal hiện có):
- **Phạm vi nội dung**: ☑ chọn phần I–V (mặc định tất cả; tối thiểu 1).
- **Kiểu nội dung**: "Đầy đủ (chart + bảng)" / "Rút gọn (chỉ KPI + bảng)" — bản rút gọn bỏ chụp chart, xuất nhanh hơn.
- Hiển thị tóm tắt kỳ & filter đang áp dụng để user xác nhận đúng phạm vi.
- Nút "Xuất PDF" → progress: dùng `toast.loading` cập nhật từng bước ("Đang dựng biểu đồ… 8/19", "Đang tạo PDF…"), nút disable khi đang chạy.

## 6. Kiến trúc code

```
utils/managementReportPdf/
  index.ts            // generateManagementReport(options) — điều phối
  theme.ts            // màu, font size, spacing tokens (navy/slate/orange)
  fonts.ts            // load Roboto Regular + Bold (tái sử dụng cache pattern từ businessPlanPdf)
  layout.ts           // header/footer/pagination, ensureSpace(), sectionTitle()
  sections/
    cover.ts          // trang bìa
    executiveSummary.ts
    chartBlock.ts     // nhúng PNG chart + caption
    tables.ts         // các bảng autoTable (AR aging, top customers, monthly…)
    approval.ts       // trang ký
components/analytics/
  ExportReportDialog.tsx   // modal tuỳ chọn
  ReportPrintLayout.tsx    // layout ẩn render toàn bộ card visible (light, 794px)
hooks/
  useReportCapture.ts      // mount print layout → đợi render → toPng từng card → trả Map<cardId, dataUrl>
```

Điểm tích hợp `Analytics.tsx`:
1. Gắn `onClick` nút Xuất báo cáo → `setShowExportDialog(true)`.
2. Truyền các dataset memo + `visibleOrderedIds` + filter context vào dialog (gom thành 1 object `reportData` để tránh prop-drilling 30 biến — cân nhắc tách `useAnalyticsData()` hook nếu thuận tiện, nhưng **không refactor lớn trong scope này**).
3. Tên file: `BaoCaoQuanTri_CIC_<DonVi|ToanCongTy>_<Nam><Quy>_<yyyyMMdd>.pdf`, lưu qua `showSaveFilePicker` + fallback anchor (tái dùng nguyên hàm save của `businessPlanPdf.ts` — tách ra `utils/savePdf.ts` dùng chung).

## 7. Lộ trình triển khai (5 bước)

| Bước | Nội dung | Đầu ra kiểm chứng |
|---|---|---|
| 1 | Hạ tầng: thêm `Roboto-Bold.ttf`, module `theme/fonts/layout/savePdf`, trang bìa + header/footer + trang ký | PDF khung rỗng đúng nhận diện, số trang chuẩn |
| 2 | Phần I + các bảng dữ liệu (II–V dạng bảng) từ dataset memo, gating phân quyền | PDF "Rút gọn" hoàn chỉnh, số khớp UI |
| 3 | `ReportPrintLayout` + `useReportCapture` + `chartBlock` — nhúng chart | PDF "Đầy đủ" có chart nét @2x, nền sáng kể cả khi app dark mode |
| 4 | `ExportReportDialog` (chọn phần, kiểu nội dung, progress toast), wire nút | Luồng UX hoàn chỉnh từ nút bấm |
| 5 | Hoàn thiện: chống cắt khối, tên file, edge cases (filter rỗng dữ liệu → EmptyState text "Không có dữ liệu trong kỳ"), thử với role bị giới hạn card | QA checklist mục 8 pass |

## 8. Checklist nghiệm thu

- [ ] Mở bằng Adobe/Chrome/in giấy: chữ vector sắc nét, không vỡ trang giữa chart/bảng.
- [ ] Tiếng Việt đủ dấu ở mọi cấp (tiêu đề bold, bảng, footer).
- [ ] App ở dark mode → PDF vẫn nền trắng.
- [ ] User role hạn chế (không có quyền profit) → PDF không chứa bất kỳ số lợi nhuận nào.
- [ ] Filter Hãng/SP/KH đang bật → số liệu PDF khớp UI và trang bìa ghi rõ phạm vi lọc.
- [ ] Dataset rỗng (năm chưa có HĐ) → các khối hiện "Không có dữ liệu", không crash.
- [ ] Thời gian xuất bản Đầy đủ < ~10s với dữ liệu thật; có progress hiển thị.

## 9. Rủi ro & phương án

| Rủi ro | Phương án |
|---|---|
| Recharts render chậm trong layout ẩn → chụp thiếu hình | Đợi theo `requestAnimationFrame` ×2 + poll DOM `svg` có kích thước > 0, timeout 5s/card rồi bỏ qua card đó kèm ghi chú trong PDF |
| Font bold thiếu → tiêu đề nhạt | Bổ sung `Roboto-Bold.ttf` (bước 1); fallback giả-bold bằng `setFont(…, 'normal')` + tăng size nếu fetch lỗi |
| Bộ nhớ khi chụp ~20 ảnh @2x | Chụp tuần tự từng card, revoke dataUrl sau khi `addImage` |
| `html2pdf.js`/`html2canvas` không dùng tới | Không đụng tới; cân nhắc gỡ dependency ở việc khác (ngoài scope) |
