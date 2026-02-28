# Quy Tắc Dự Án (Project Rules)
Tài liệu này định nghĩa các quy tắc làm việc cốt lõi cho dự án này.
## 1. Giao Tiếp (Communication)
- **Ngôn ngữ chính**: Tiếng Việt.
- Mọi trao đổi, giải thích, và tài liệu (trừ code và comments kỹ thuật nếu cần thiết) sẽ được thực hiện bằng Tiếng Việt để đảm bảo sự rõ ràng và thống nhất.
## 2. Quản Lý Mã Nguồn (Source Control)
### Quy trình Git (BẮT BUỘC tuân thủ):

**Bước 1: Pull trước khi code**
```bash
git pull origin main
```
> ⚠️ LUÔN pull trước khi bắt đầu code để đảm bảo có phiên bản mới nhất.

**Bước 2: Code xong → Commit**
```bash
git add .
git commit -m "feat: mô tả thay đổi"
```
> Commit message tuân theo format: `feat:`, `fix:`, `refactor:`, `docs:`, `chore:`

**Bước 3: Pull lại trước khi push**
```bash
git pull origin main
```
> ⚠️ Phòng trường hợp người khác đã push trong lúc mình code.

**Bước 4: Push (nếu không có conflict)**
```bash
git push origin main
```
> ❌ Nếu có conflict → resolve conflict trước → commit lại → rồi mới push.

### Tóm tắt nhanh:
```
pull → code → commit → pull → push
```

## 3. Auto-Load Skills
Mỗi khi chỉnh sửa liên quan đến giao diện frontend (bao gồm: sửa component, thay đổi layout, styling, colors, animations, responsive, dark mode, typography, spacing, tạo component mới, hoặc bất kỳ thay đổi visual nào), bạn PHẢI:
1. Đọc file skill: `../.agent/skills/ui-ux-pro-max/SKILL.md`
2. Áp dụng các nguyên tắc và hướng dẫn trong skill đó vào quá trình thiết kế/chỉnh sửa
3. Đảm bảo output đạt chất lượng UI/UX cao nhất theo skill guidelines

## 4. 🌙 Dark Mode (BẮT BUỘC)

> App dùng Tailwind `dark:` class strategy. Mọi element PHẢI có dark variant đồng bộ.

### 4.1 KHÔNG dùng text color cứng — Luôn thêm `dark:` variant
```
❌ text-indigo-600
✅ text-indigo-600 dark:text-indigo-400
```
| Light Mode | Dark Mode |
|------------|-----------|
| `text-{color}-600` | `dark:text-{color}-400` |
| `text-{color}-700` | `dark:text-{color}-400` |
| `text-{color}-900` | `dark:text-slate-100` |
| `text-slate-500` | `dark:text-slate-400` |

### 4.2 KHÔNG dùng opacity thấp cho nền dark — Dùng full opacity
```
❌ dark:bg-slate-800/50    (lộ nền trắng)
❌ dark:bg-slate-800/30    (gần như không thấy)
✅ dark:bg-slate-800       (full opacity)
```
| Light Mode | Dark Mode |
|------------|-----------|
| `bg-white` | `dark:bg-slate-900` |
| `bg-slate-50` | `dark:bg-slate-800` |
| `bg-slate-100` | `dark:bg-slate-800` |
| `bg-{color}-50` | `dark:bg-{color}-900/20` |
| `bg-{color}-100` | `dark:bg-{color}-900/30` |

### 4.3 KHÔNG quên hover — Mọi hover PHẢI có `dark:hover:` variant
```
❌ hover:bg-slate-50
✅ hover:bg-slate-50 dark:hover:bg-slate-800
```

### 4.4 KHÔNG quên border
```
❌ border-slate-200
✅ border-slate-200 dark:border-slate-800
```

### Checklist khi viết component mới:
- [ ] Mọi `bg-white` → `dark:bg-slate-900`
- [ ] Mọi `bg-slate-50/100` → `dark:bg-slate-800`
- [ ] Mọi `text-{color}-600/700` → `dark:text-{color}-400`
- [ ] Mọi `text-slate-900` → `dark:text-slate-100`
- [ ] Mọi `border-slate-200` → `dark:border-slate-800`
- [ ] Mọi `hover:bg-*` → `dark:hover:bg-*`
- [ ] KHÔNG dùng opacity < 1.0 cho `dark:bg-slate-*`

