
# CIC ERP Contract - Project Rules

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
