# Quy Tắc Dự Án (Project Rules)
Tài liệu này định nghĩa các quy tắc làm việc cốt lõi cho dự án này.
## 1. Giao Tiếp (Communication)
- **Ngôn ngữ chính**: Tiếng Việt.
- Mọi trao đổi, giải thích, và tài liệu (trừ code và comments kỹ thuật nếu cần thiết) sẽ được thực hiện bằng Tiếng Việt để đảm bảo sự rõ ràng và thống nhất.
## 2. Quản Lý Mã Nguồn (Source Control)

- **GitHub Policy**: Code PHẢI được đẩy (push) lên GitHub sau mỗi lần cập nhật hoặc hoàn thành một tác vụ.

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
