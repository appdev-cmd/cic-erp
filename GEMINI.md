
# CIC ERP Contract - Project Rules

## 🇻🇳 Ngôn ngữ (BẮT BUỘC)

> Mọi tài liệu kế hoạch triển khai (implementation plan), ý tưởng (ideation), walkthrough, báo cáo, và artifact khác **PHẢI viết bằng tiếng Việt**.
> Code, comments trong code, tên biến/hàm/file vẫn dùng tiếng Anh.
> ❌ KHÔNG viết implementation plan, ideation, hay báo cáo bằng tiếng Anh.

## ⚠️ Git Push (BẮT BUỘC mỗi khi user nói "push", "push github", "đẩy code"):
Luôn tuân thủ đúng quy trình, KHÔNG ĐƯỢC bỏ bước nào:
```
1. git pull origin main          ← pull trước
2. git add .                     ← stage changes
3. git status                    ← kiểm tra files
4. git commit -m "type: mô tả"  ← commit (feat/fix/docs/refactor/chore)
5. git pull origin main          ← pull lại phòng conflict
6. git push origin main          ← push
```
> ❌ KHÔNG BAO GIỜ push thẳng mà không pull trước và sau commit.

## Auto-Load Skills:
Mỗi khi chỉnh sửa giao diện frontend (bao gồm: sửa component, thay đổi layout, styling, colors, animations, responsive, dark mode, typography, spacing, tạo component mới, hoặc bất kỳ thay đổi visual nào), bạn PHẢI:
1. Đọc file skill: `D:\QuocAnh\2026\01.Project\cic-erp-contract\.agent\skills\ui-ux-pro-max\SKILL.md`
2. Áp dụng các nguyên tắc và hướng dẫn trong skill đó vào quá trình thiết kế/chỉnh sửa
3. Đảm bảo output đạt chất lượng UI/UX cao nhất theo skill guidelines

---

## 🌙 Dark Mode Rules (BẮT BUỘC)

> App dùng Tailwind `dark:` class strategy. Mọi element PHẢI có dark variant đồng bộ.

### Lỗi thường gặp và cách tránh:

### 1. KHÔNG dùng text color cứng — Luôn thêm `dark:` variant
```
❌ text-indigo-600
✅ text-indigo-600 dark:text-indigo-400

❌ text-emerald-600
✅ text-emerald-600 dark:text-emerald-400
```
**Quy tắc chuyển đổi màu text:**
| Light Mode | Dark Mode |
|------------|-----------|
| `text-{color}-600` | `dark:text-{color}-400` |
| `text-{color}-700` | `dark:text-{color}-400` |
| `text-{color}-900` | `dark:text-slate-100` |
| `text-slate-500` | `dark:text-slate-400` |

### 2. KHÔNG dùng opacity thấp cho nền dark — Dùng full opacity
```
❌ dark:bg-slate-800/50    (50% opacity → gần trong suốt, lộ nền trắng)
❌ dark:bg-slate-800/30    (30% opacity → gần như không thấy)
✅ dark:bg-slate-800       (full opacity → nền tối rõ ràng)
```
**Quy tắc chuyển đổi nền:**
| Light Mode | Dark Mode |
|------------|-----------|
| `bg-white` | `dark:bg-slate-900` |
| `bg-slate-50` | `dark:bg-slate-800` |
| `bg-slate-100` | `dark:bg-slate-800` |
| `bg-{color}-50` | `dark:bg-{color}-900/20` |
| `bg-{color}-100` | `dark:bg-{color}-900/30` |

### 3. KHÔNG quên hover/focus states — Mọi hover PHẢI có `dark:hover:` variant
```
❌ hover:bg-slate-50
✅ hover:bg-slate-50 dark:hover:bg-slate-800

❌ hover:bg-indigo-50
✅ hover:bg-indigo-50 dark:hover:bg-indigo-900/30
```

### 4. KHÔNG quên border — Luôn thêm `dark:border-` variant
```
❌ border-slate-200
✅ border-slate-200 dark:border-slate-800
```

### Checklist khi viết component mới:
- [ ] Mọi `bg-white` đều có `dark:bg-slate-900`
- [ ] Mọi `bg-slate-50` / `bg-slate-100` đều có `dark:bg-slate-800`
- [ ] Mọi `text-{color}-600/700` đều có `dark:text-{color}-400`
- [ ] Mọi `text-slate-900` đều có `dark:text-slate-100`
- [ ] Mọi `border-slate-200` đều có `dark:border-slate-800`
- [ ] Mọi `hover:bg-*` đều có `dark:hover:bg-*` tương ứng
- [ ] KHÔNG dùng opacity < 1.0 cho `dark:bg-slate-*` (dùng full opacity)

---

## 📅 Date Format Rules (BẮT BUỘC - dd/mm/yyyy)

> Mọi hiển thị ngày tháng PHẢI dùng utility functions từ `utils/formatters.ts`.
> ❌ KHÔNG BAO GIỜ dùng `toLocaleDateString()` trực tiếp trong component.

### Các hàm format ngày tháng:

| Hàm | Output | Dùng khi |
|-----|--------|----------|
| `formatDate(dateStr)` | `01/03/2026` | Hiển thị ngày đầy đủ (dd/mm/yyyy) |
| `formatDateShort(dateStr)` | `01/03` | Hiển thị ngày ngắn (dd/mm) — task cards, badges |
| `formatDateCompact(dateStr)` | `01/03/26` | Hiển thị ngày compact (dd/mm/yy) — bảng nhỏ |
| `formatDateTime(dateStr)` | `01/03/2026 14:30` | Hiển thị ngày + giờ |
| `formatDateFull(dateStr)` | `Thứ hai, 01/03/2026` | Hiển thị ngày có thứ — headers |

### Cách dùng:
```tsx
import { formatDate, formatDateShort } from '../utils/formatters';

// ✅ ĐÚNG
{formatDate(contract.signedDate)}
{formatDateShort(task.due_date)}

// ❌ SAI — Không bao giờ dùng trực tiếp
{new Date(dateStr).toLocaleDateString('vi-VN')}
{new Date(dateStr).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' })}
```

### Ngoại lệ cho phép:
- Calendar/Gantt **month headers** (`month: 'long'`, `month: 'short'`) — vì hiển thị tên tháng, không phải ngày
- Page **header labels** hiển thị ngày hôm nay dạng prose (`weekday: 'long', day: 'numeric', month: 'long'`)

### Checklist khi viết component có ngày tháng:
- [ ] Import hàm format phù hợp từ `utils/formatters`
- [ ] KHÔNG dùng `toLocaleDateString()` trực tiếp
- [ ] Truyền giá trị fallback nếu date có thể null/undefined

### Date Picker / Date Input Rules (BẮT BUỘC):
> ❌ KHÔNG BAO GIỜ dùng `<input type="date">` hoặc `<input type="datetime-local">` trực tiếp.
> ✅ LUÔN dùng component `DateInput` từ `components/ui/DateInput.tsx` (cho date-only).
> ✅ Với datetime, dùng text input hiển thị `dd/mm/yyyy HH:mm` + hidden native picker.

```tsx
// ✅ ĐÚNG — Date-only picker
import DateInput from '../ui/DateInput';
<DateInput value={startDate} onChange={setStartDate} className={inputCls} />

// ❌ SAI — Native date input (hiển thị yyyy-mm-dd trên một số browser)
<input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} />
```

### Checklist khi viết component có date picker:
- [ ] Dùng `DateInput` component thay vì native `type="date"`
- [ ] Nếu cần datetime, tạo text input dd/mm/yyyy HH:mm + hidden `datetime-local`
- [ ] Hiển thị ngày đã chọn phải dùng `formatDate()` hoặc `formatDateTime()`

---

## ⚡ Auto-Run Commands Rule (BẮT BUỘC)

> Để tối ưu hóa quy trình làm việc và giảm thiểu gián đoạn cho người dùng (không phải bấm nút RUN liên tục), bạn PHẢI tuân thủ:

1. **Luôn thiết lập `SafeToAutoRun: true`** khi gọi tool `run_command` hoặc `send_command_input` đối với các lệnh an toàn, không có tính phá hủy (ví dụ: khởi chạy server `npm run dev`, git status, xem log, biên dịch thử, v.v.).
2. **Ưu tiên sử dụng API tools cụ thể** (`view_file`, `replace_file_content`, `list_dir`, `grep_search`...) thay vì dùng shell commands để thao tác với file/thư mục. Việc dùng API tools sẽ không yêu cầu user phê duyệt.
3. **KHÔNG BAO GIỜ** thiết lập `SafeToAutoRun: true` cho các lệnh có nguy cơ phá hủy hoặc tác động tiêu cực chưa lường trước (như xóa file, drop database, cài đặt system dependencies lạ).
