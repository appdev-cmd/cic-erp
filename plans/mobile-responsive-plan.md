# Kế hoạch thiết kế giao diện Mobile/Responsive cho CIC ERP

> Ngày lập: 2026-06-13
> Phạm vi: Toàn hệ thống, ưu tiên **báo cáo/dashboard**, hạn chế nhập liệu trên mobile.

---

## 1. KẾT QUẢ RÀ SOÁT HIỆN TRẠNG

### 1.1. Nền tảng kỹ thuật
| Hạng mục | Hiện trạng | Đánh giá |
|---|---|---|
| CSS framework | Tailwind (CDN, `tailwind.config` inline trong index.html) | Đủ dùng, breakpoints chuẩn: sm 640 / md 768 / lg 1024 / xl 1280 |
| Viewport meta | `maximum-scale=1.0, user-scalable=no` | ⚠️ Chặn zoom — vi phạm accessibility, cần sửa |
| PWA | `vite-plugin-pwa` (autoUpdate) đã cấu hình | ✅ Có thể cài lên màn hình chính điện thoại |
| Charts | Recharts + `ResponsiveContainer` (84 chỗ, 9 file) | ✅ Tự co giãn theo container |
| Hook responsive dùng chung | **Không có** — mỗi nơi tự check `window.innerWidth < 768` (ContractList, Sidebar, DocumentManager) | ❌ Cần hook `useBreakpoint` thống nhất |

### 1.2. Layout khung (MainLayout / Sidebar / Header)
- **Sidebar**: đã có drawer mobile (overlay + `translate-x`, backdrop `md:hidden`) — hoạt động được. Tính năng resize sidebar chỉ áp dụng ≥768px (đúng).
- **Header**: đã có hàng filter thứ 2 cho mobile (`lg:hidden` dòng 330) — đơn vị/năm/kỳ vẫn lọc được trên điện thoại. Offset nội dung hardcode `mt-[120px] lg:mt-16` — dễ vỡ khi header mobile cao hơn (text dài, thêm filter).
- **SlidePanel** (panel trượt kiểu Bitrix24): width tính theo `calc(100% - stackOffset)`, có 1 media query 768px. Trên điện thoại panel xếp chồng + "tab ear" chiếm chỗ → cần chế độ **full-screen trên mobile**.

### 1.3. Các trang báo cáo (ưu tiên cao nhất)
| Trang | File | Hiện trạng mobile |
|---|---|---|
| Dashboard | `Dashboard.tsx` (53KB) | Khá tốt: KPI grid `grid-cols-1→5`, có `overflow-x-auto` cho bảng. Cần tinh chỉnh. |
| Phân tích (Analytics) | `Analytics.tsx` (**200KB**, 52 charts, 4 tab: overview / cashflow / product_brand / employee_customer) | Grid KPI `grid-cols-2 lg:grid-cols-4` OK, nhưng nhiều bảng/card bên trong chưa kiểm soát; tab bar + bộ lọc chưa tối ưu chạm. File quá lớn, khó bảo trì. |
| Báo cáo lưu trữ | `ReportListPage.tsx`, `ReportViewerPage.tsx` | Bảng danh sách chưa có card view mobile; viewer PDF cần kiểm tra trên màn hình hẹp. |
| Báo cáo quản trị PDF | `analytics/ReportPrintLayout.tsx`, `ExportReportDialog.tsx`, `useReportCapture.tsx` | Xuất PDF từ DOM capture — cần render ở width cố định khi capture để không phụ thuộc màn hình thiết bị. |
| Rà soát hợp đồng | `ContractReviewPage.tsx` | Có bảng `<table>` rộng, chưa có fallback mobile. |

### 1.4. Bảng dữ liệu — điểm yếu lớn nhất
- **63 file** chứa `<table>` thô; chỉ **ContractList** đã làm chuẩn mẫu: bảng desktop (`hidden md:block`) + card list mobile (`md:hidden`) + state `isMobile`.
- Các trang list còn lại (PaymentList, CustomerList, ProductList, PersonnelList, ProjectList, CRM leads/deals/quotes, HRM payroll/leave/insurance, các settings manager) đa số chưa có mobile view → tràn ngang, chữ nhỏ, khó chạm.
- Có sẵn `ui/DataTable.tsx` nhưng chưa hỗ trợ chế độ card mobile.

### 1.5. Form nhập liệu
- Các form rất nặng: `ContractForm` 4 bước (53KB), `PaymentForm` (67KB), `ProjectForm` (61KB), import modal hàng loạt (Excel)… — **không phù hợp và không cần thiết trên điện thoại** theo định hướng "hạn chế nhập liệu".
- Nhập liệu thực sự cần trên mobile (nghiệp vụ phê duyệt/cộng tác): duyệt/từ chối hợp đồng (workflow), duyệt nghỉ phép/OT (HRM), cập nhật trạng thái + bình luận task, ghi chú nhanh khách hàng, chat.

---

## 2. NGUYÊN TẮC THIẾT KẾ

1. **Mobile = nơi XEM, desktop = nơi NHẬP.** Điện thoại phục vụ: xem báo cáo, tra cứu, phê duyệt, bình luận. Tạo mới/sửa dữ liệu phức tạp chỉ trên desktop/tablet ngang.
2. **Breakpoint chuẩn hóa** (theo Tailwind hiện có):
   - `< 640` — điện thoại dọc (360–430px): 1 cột, card list, KPI 2 cột
   - `640–767 (sm)` — điện thoại ngang: KPI 3 cột, vẫn card list
   - `768–1023 (md)` — tablet dọc: bắt đầu hiện bảng (rút gọn cột), sidebar drawer
   - `≥ 1024 (lg)` — tablet ngang / desktop: giao diện đầy đủ
3. **Không làm app riêng, không đổi route** — cùng 1 trang render thích ứng. PWA đã có sẵn để "cài app".
4. **Bảng dữ liệu**: < md hiển thị card (3–5 trường quan trọng nhất + trạng thái), ≥ md hiển thị bảng; bảng rộng bắt buộc có `overflow-x-auto` + sticky cột đầu.
5. **Chạm**: mọi nút/hàng bấm được ≥ 44px; bỏ hành vi hover-only (dropdown, tooltip phải mở được bằng tap).
6. **Xoay màn hình**: dùng breakpoint theo width (Tailwind tự xử lý xoay); chart full-width khi dọc, 2 cột khi ngang; PDF export render ở width cố định (không phụ thuộc thiết bị).

---

## 3. LỘ TRÌNH THỰC HIỆN

### Phase 0 — Nền móng (1 tuần)
| # | Việc | File liên quan |
|---|---|---|
| 0.1 | Tạo hook `useBreakpoint()` / `useIsMobile()` dùng `matchMedia` (thay 4 chỗ tự check `innerWidth`) | `hooks/useBreakpoint.ts` (mới); sửa `ContractList.tsx:71`, `Sidebar.tsx:36`, `DocumentManager.tsx:876` |
| 0.2 | Sửa viewport meta: bỏ `maximum-scale=1.0, user-scalable=no`; thêm `viewport-fit=cover` + safe-area-inset (tai thỏ) | `index.html:6` |
| 0.3 | Component dùng chung: `ResponsiveTable` (bảng ≥md / card <md, nhận `mobileCard` renderer) — mở rộng `ui/DataTable.tsx` theo mẫu ContractList | `components/ui/DataTable.tsx`, mẫu: `ContractList.tsx:881,1013` |
| 0.4 | Component `MobileActionBar` (thanh hành động dính đáy cho nút chính trên mobile) + chuẩn touch-target 44px vào RULES.md | mới |
| 0.5 | Header: thay `mt-[120px]` hardcode bằng CSS var `--header-height` đo thực tế | `layout/MainLayout.tsx:296`, `Header.tsx` |
| 0.6 | SlidePanel: chế độ full-screen khi `< md` (ẩn tab-ear, width 100%, nút back) | `ui/SlidePanel.tsx`, `styles/slide-panel.css` |

### Phase 1 — Báo cáo & Dashboard (ưu tiên, 2–3 tuần)
| # | Việc | Chi tiết |
|---|---|---|
| 1.1 | **Dashboard**: rà từng card trên 360px; bảng tổng hợp → sticky cột đơn vị + cuộn ngang; KPI strip 2 cột phone | `Dashboard.tsx` |
| 1.2 | **Analytics** (trọng tâm): tab bar 4 tab → scrollable + sticky top khi cuộn; bộ lọc (đơn vị/năm/kỳ) gom vào bottom-sheet trên mobile; mỗi card chart full-width <lg; bảng chi tiết trong card → card-list hoặc cuộn ngang sticky cột đầu; giảm mật độ trục/label chart khi width nhỏ (tick interval, ẩn legend phụ) | `Analytics.tsx` — cân nhắc tách file theo tab trước khi sửa (200KB) |
| 1.3 | **ReportListPage / ReportViewerPage**: danh sách → card mobile; viewer PDF co theo width + pinch-zoom | `ReportListPage.tsx`, `ReportViewerPage.tsx` |
| 1.4 | **Xuất PDF báo cáo quản trị**: capture ở width cố định 1280px (off-screen render) để PDF giống nhau trên mọi thiết bị | `analytics/useReportCapture.tsx`, `ReportPrintLayout.tsx` |
| 1.5 | **ContractReviewPage**: chế độ xem mobile (card theo hợp đồng + badge cảnh báo bất thường), nút duyệt/từ chối trong MobileActionBar | `ContractReviewPage.tsx` |

### Phase 2 — Danh sách & trang chi tiết (chỉ XEM, 2–3 tuần)
| # | Việc | Chi tiết |
|---|---|---|
| 2.1 | Nhân rộng pattern ContractList sang: `PaymentList`, `CustomerList`, `ProductList`, `PersonnelList`, `ProjectList`, `UnitList`, `NewsList` | dùng `ResponsiveTable` từ 0.3 |
| 2.2 | CRM (`crm/leads`, `deals`, `companies`, `contacts`, `quotes`): list view → card; kanban → cuộn ngang snap từng cột | `crm/**` |
| 2.3 | HRM (payroll, leave, insurance, attendance): bảng lương rộng → cuộn ngang sticky cột tên; self-service portal ưu tiên mobile (nhân viên xem phiếu lương, ngày phép trên điện thoại) | `hrm/**` |
| 2.4 | Trang chi tiết (ContractDetail, CustomerDetail, PersonnelDetail, UnitDetail…): tab bar cuộn ngang; grid 2 cột → 1 cột; SlidePanel full-screen (đã có từ 0.6) | các `*Detail.tsx` |
| 2.5 | Tasks: BitrixListView → card; GanttView ẩn trên phone (hiện thông báo "xem trên màn hình lớn"), giữ list/kanban | `tasks/**` |

### Phase 3 — Nhập liệu tối thiểu trên mobile (1–2 tuần)
**Danh sách TRẮNG được nhập trên mobile** (mọi thứ khác: chỉ xem):
1. Phê duyệt / từ chối hợp đồng + lý do (workflow) — `workflow/ApprovalStepper`, `RejectDialog`
2. Phê duyệt nghỉ phép / OT / đề xuất HRM
3. Task: đổi trạng thái, bình luận, log giờ
4. Bình luận / ghi chú nhanh (khách hàng, hợp đồng)
5. Chat nội bộ + Chat AI (đã có)
6. Tìm kiếm / bộ lọc (mọi trang)

| # | Việc | Chi tiết |
|---|---|---|
| 3.1 | Các form lớn (ContractForm, PaymentForm, ProjectForm, import Excel modals): khi `< md` hiện màn hình "Chức năng này cần màn hình lớn" + nút copy link mở trên desktop. Ẩn nút "Thêm mới/Import" trên mobile ở các trang này | dùng `useIsMobile` |
| 3.2 | Các dialog thuộc whitelist: chuyển sang **bottom-sheet** trên mobile (dễ chạm, bàn phím không che) | `ConfirmDialog`, `RejectDialog`, `AcceptanceDialog`, comment box |
| 3.3 | Input tối ưu mobile: `inputmode="numeric"` cho số tiền, `enterkeyhint`, font-size ≥16px tránh iOS auto-zoom | `ui/Input.tsx`, `ui/NumberInput.tsx` |
| 3.4 | Settings / quản trị (PermissionManager, AnomalyRuleManager, các manager): chỉ desktop — hiện thông báo trên mobile | `settings/**` |

### Phase 4 — Kiểm thử & hoàn thiện (1 tuần)
| # | Việc |
|---|---|
| 4.1 | Ma trận kiểm thử (preview_resize / DevTools): **360×640** (Android nhỏ), **390×844** (iPhone), **844×390** (phone ngang), **768×1024** (iPad dọc), **1024×768** (iPad ngang), 1280+ (desktop regression) |
| 4.2 | Checklist từng trang: không tràn ngang, touch ≥44px, bàn phím không che input, dark mode OK, xoay màn hình không vỡ layout |
| 4.3 | Hiệu năng mobile: lazy-load chart theo tab (Analytics), kiểm tra bundle (Tailwind CDN → cân nhắc build-time Tailwind để giảm tải mạng yếu) |
| 4.4 | PWA: kiểm tra manifest icons, splash, orientation `any`; test cài đặt trên Android/iOS thực tế |

---

## 4. THỨ TỰ ƯU TIÊN TÓM TẮT
1. 🥇 Phase 0 + 1: nền móng + **Dashboard, Analytics, Báo cáo** (giá trị cao nhất cho lãnh đạo xem số liệu trên điện thoại)
2. 🥈 Phase 2: danh sách/chi tiết chế độ xem + phê duyệt (ContractReview, HRM approvals)
3. 🥉 Phase 3: chuẩn hóa nhập liệu tối thiểu, chặn form lớn trên mobile
4. Phase 4: kiểm thử ma trận thiết bị + PWA

## 5. RỦI RO & LƯU Ý
- `Analytics.tsx` 200KB là rủi ro lớn nhất — nên tách theo tab **trước khi** sửa responsive để tránh conflict.
- Đang có 4 file modified chưa commit (ContractReviewPage, Settings, AnomalyRuleManager, useContractAnomalyConfig) — commit trước khi bắt đầu.
- Tailwind CDN nghĩa là mọi class responsive đều hợp lệ runtime, nhưng không tree-shake — cân nhắc chuyển build-time ở Phase 4.
- PDF/Excel export phải render độc lập viewport (1.4) — nếu không, báo cáo xuất từ điện thoại sẽ bị bóp méo.
