# 🔐 Kế hoạch Bảo mật Toàn diện — CIC ERP

## Tổng quan

Báo cáo tổng hợp kết quả kiểm tra bảo mật toàn diện hệ thống CIC ERP, bao gồm:
- **3 mảng kiểm tra**: Xác thực & Phân quyền, Frontend, Backend & Dữ liệu
- **28 phát hiện bảo mật** được phân loại theo mức độ nghiêm trọng
- **Kế hoạch khắc phục 4 giai đoạn** với timeline cụ thể
- **Đề xuất cơ chế Backup & Recovery** để khôi phục nhanh nếu bị tấn công

---

## 📊 Tóm tắt phát hiện

| Mức độ | Số lượng | Mô tả |
|--------|----------|-------|
| 🔴 **CRITICAL** | 7 | Cần xử lý NGAY LẬP TỨC — Rủi ro mất toàn bộ dữ liệu |
| 🟠 **HIGH** | 8 | Cần xử lý trong tuần — Rủi ro bị tấn công khai thác |
| 🟡 **MEDIUM** | 8 | Sprint tiếp theo — Cải thiện phòng thủ |
| 🟢 **LOW** | 5 | Cải thiện dần — Best practices |

---

## 🚨 CRITICAL — Xử lý NGAY LẬP TỨC

### C1. Service Role Key bị lộ trên Client-Side (VITE_ prefix)

> [!CAUTION]
> **Đây là lỗ hổng nghiêm trọng nhất!** Service Role Key bypass toàn bộ RLS, cho phép đọc/ghi/xóa MỌI dữ liệu trong database.

- **File**: [.env](file:///d:/CIC%20ERP/.env) (dòng 4)
- **File**: [dataClient.ts](file:///d:/CIC%20ERP/lib/dataClient.ts#L47-L48)
- **Vấn đề**: `VITE_SUPABASE_SERVICE_ROLE_KEY` có prefix `VITE_` → Vite embed vào client-side JS bundle → bất kỳ ai inspect browser đều thấy key → **full access database**
- **Hành động**:
  1. 🔄 **Rotate key NGAY** trên Supabase Dashboard → Project Settings → API → Regenerate service_role key
  2. Đổi tên biến → `SUPABASE_SERVICE_ROLE_KEY` (bỏ prefix `VITE_`)
  3. Chỉ sử dụng trong server-side code (API routes, scripts)
  4. Kiểm tra git history: `git log --all --full-history -- .env`

---

### C2. Mật khẩu Dev bị hardcode trong `.env`

- **File**: [.env](file:///d:/CIC%20ERP/.env) (dòng 1-2)
- **Nội dung**: `VITE_DEV_EMAIL=anhnq@cic.com.vn` + `VITE_DEV_PASSWORD=Abc123456`
- **Vấn đề**: Password thật bị nhúng vào client bundle (prefix `VITE_`), bất kỳ ai xem source đều thấy
- **Hành động**: Xóa `VITE_DEV_PASSWORD`, dùng cơ chế dev token riêng không liên quan password thật

---

### C3. API Keys AI (OpenAI, DeepSeek, Google) lộ Client-Side

- **File**: [.env.local](file:///d:/CIC%20ERP/.env.local) (dòng 3-5)
- **Các key bị lộ**: `VITE_DEEPSEEK_API_KEY`, `VITE_GOOGLE_API_KEY`, `VITE_OPENAI_API_KEY`
- **Vấn đề**: Prefix `VITE_` → embed vào production bundle → bất kỳ user nào trích xuất được key → **lạm dụng quota, tốn chi phí**
- **Hành động**: Bỏ prefix `VITE_`, chuyển tất cả AI API calls qua server-side proxy

---

### C4. Hardcoded Supabase Credentials trong Source Code

- **File**: [supabaseDefaults.ts](file:///d:/CIC%20ERP/lib/supabaseDefaults.ts) (dòng 5-8)
- **Vấn đề**: URL + anon key hardcode trong code đã commit → lộ project ref, kết hợp RLS yếu = nguy hiểm
- **Hành động**: Đọc từ env vars, throw error nếu thiếu thay vì dùng defaults

---

### C5. Hardcoded LiteLLM API Key

- **File**: [gateway.ts](file:///d:/CIC%20ERP/services/ai/gateway.ts) (dòng 30)
- **Code**: Fallback `'sk-cic-2026'` hardcoded → lộ trong client bundle production
- **Hành động**: Xóa fallback hardcoded, bắt buộc env var

---

### C6. `exec_sql`/`execute_sql` RPC — Remote Code Execution

> [!CAUTION]
> Nếu RPC function này accessible qua anon key, bất kỳ ai có anon key đều chạy được **arbitrary SQL** trên database → **chiếm quyền toàn bộ hệ thống**.

- **Files sử dụng**: [apply-hrm-migrations.ts](file:///d:/CIC%20ERP/scripts/apply-hrm-migrations.ts), [apply-trigger-migration.ts](file:///d:/CIC%20ERP/scripts/apply-trigger-migration.ts)
- **Hành động**: 
  1. Kiểm tra RLS policy cho function → chỉ service_role mới gọi được
  2. Nếu không cần nữa → `DROP FUNCTION exec_sql` + `DROP FUNCTION execute_sql`

---

### C7. Debug page exposed trên production

- **File**: [debug.html](file:///d:/CIC%20ERP/public/debug.html)
- **Vấn đề**: Cho phép nhập Supabase key → truy vấn DB, check RLS, thậm chí **Disable RLS**
- **Hành động**: Xóa file ngay hoặc di chuyển ra khỏi `public/`

---

## 🟠 HIGH — Xử lý trong tuần

### H1. RLS thiếu Write Policies cho bảng chính

- **Bảng ảnh hưởng**: `contracts`, `payments`, `customers`, `employees`
- **Vấn đề**: Migration `20260514` chỉ tạo SELECT policies, KHÔNG tạo INSERT/UPDATE/DELETE policies → authenticated user nào cũng ghi/xóa được
- **Hành động**: Tạo RLS policies đầy đủ cho mỗi bảng (tham khảo mẫu từ migration `20260526083000`)

### H2. 7x XSS via `dangerouslySetInnerHTML` — Không có Sanitization

> [!WARNING]
> Dự án **KHÔNG có DOMPurify hay bất kỳ sanitization library nào**. Tất cả HTML từ database render raw → Stored XSS vector.

| File | Dòng | Nguồn dữ liệu |
|------|------|---------------|
| [NewsDetail.tsx](file:///d:/CIC%20ERP/components/NewsDetail.tsx#L108) | 108 | `post.contentVi` |
| [ServiceDetail.tsx](file:///d:/CIC%20ERP/components/ServiceDetail.tsx#L72) | 72 | `service.contentVi` |
| [ProductDetail.tsx](file:///d:/CIC%20ERP/components/ProductDetail.tsx#L269) | 269, 335, 349 | `product.description/features/requirements` |
| [ProjectDetail.tsx](file:///d:/CIC%20ERP/components/ProjectDetail.tsx#L604) | 604 | `project.description` |
| [SignatureManagerModal.tsx](file:///d:/CIC%20ERP/components/hrm/SignatureManagerModal.tsx#L230) | 230 | `sig.html_content` |

- **Hành động**: `npm install dompurify @types/dompurify`, tạo utility `sanitizeHtml()`, wrap tất cả

### H3. AI Edge Functions thiếu Auth + CORS Wildcard

| Function | File | Vấn đề |
|----------|------|--------|
| `ai-proxy` | [index.ts](file:///d:/CIC%20ERP/supabase/functions/ai-proxy/index.ts) | Không JWT verify, CORS `*` fallback |
| `gemini-proxy` | [index.ts](file:///d:/CIC%20ERP/supabase/functions/gemini-proxy/index.ts) | CORS `*`, không auth |
| `telegram-notify` | [index.ts](file:///d:/CIC%20ERP/supabase/functions/telegram-notify/index.ts) | CORS `*`, không auth |

- **Hành động**: Thêm JWT verification, restrict CORS origins

### H4. Impersonation không giới hạn quyền

- **File**: [ImpersonationContext.tsx](file:///d:/CIC%20ERP/contexts/ImpersonationContext.tsx)
- **Vấn đề**: Không check role Admin trước khi cho impersonate + lưu localStorage → user tự sửa = giả làm Admin
- **Hành động**: Check `realProfile.role === 'Admin'`, audit log mọi impersonation

### H5. Social Webhook không verify signature

- **File**: [social-webhook.ts](file:///d:/CIC%20ERP/api/marketing/social-webhook.ts)
- **Hành động**: Verify webhook signature theo Facebook/Zalo docs

### H6. File Upload không validate type/size

- **Files**: [documentService.ts](file:///d:/CIC%20ERP/services/documentService.ts), [recruitmentService.ts](file:///d:/CIC%20ERP/services/recruitmentService.ts), [chatService.ts](file:///d:/CIC%20ERP/services/chatService.ts), [reportService.ts](file:///d:/CIC%20ERP/services/reportService.ts)
- **Hành động**: Whitelist MIME types, enforce max size (10MB), sanitize HTML uploads

### H7. API Keys lưu localStorage (plaintext) + Browser API calls

- **Files**: [aiExtractService.ts](file:///d:/CIC%20ERP/services/aiExtractService.ts), [chatService.ts](file:///d:/CIC%20ERP/services/chatService.ts), [gateway.ts](file:///d:/CIC%20ERP/services/ai/gateway.ts)
- **Vấn đề**: XSS (H2) + localStorage keys = **key theft**. `dangerouslyAllowBrowser: true` cho OpenAI/DeepSeek
- **Hành động**: Server-side proxy cho system keys, encrypt user keys trước khi lưu

### H8. OTP trả code trong response (dev mode)

- **File**: [telegram-otp/index.ts](file:///d:/CIC%20ERP/supabase/functions/telegram-otp/index.ts) (dòng 60)
- **Vấn đề**: Khi thiếu `TELEGRAM_BOT_TOKEN`, OTP trả trực tiếp → bypass verification
- **Hành động**: Không bao giờ return OTP trong response

---

## 🟡 MEDIUM — Sprint tiếp theo

### M1. Thiếu Content-Security-Policy (CSP) Header

- **File**: [vercel.json](file:///d:/CIC%20ERP/vercel.json)
- **Có**: X-Frame-Options, X-Content-Type-Options, X-XSS-Protection, Referrer-Policy ✅
- **Thiếu**: CSP, HSTS
- **Hành động**: Thêm CSP header vào vercel.json

### M2. Dev Auth Bypass Flag bundle vào client

- **File**: [AuthContext.tsx](file:///d:/CIC%20ERP/contexts/AuthContext.tsx#L28-L30)
- **Hành động**: Thêm `import.meta.env.DEV` check (Vite strips in prod build)

### M3. Session/Google Token lưu sessionStorage (plaintext)

- **Files**: [supabase.ts](file:///d:/CIC%20ERP/lib/supabase.ts#L11), [AuthContext.tsx](file:///d:/CIC%20ERP/contexts/AuthContext.tsx#L107)
- **Hành động**: Kết hợp fix XSS (H2) để giảm risk, cân nhắc HttpOnly cookies

### M4. API Routes auth bypass khi thiếu config

- **Files**: [gemini-extract.ts](file:///d:/CIC%20ERP/api/gemini-extract.ts#L93-L97), [recruitment-email.ts](file:///d:/CIC%20ERP/api/recruitment-email.ts#L52-L62)
- **Hành động**: Luôn require auth, trả 503 nếu chưa config thay vì bypass

### M5. `select('*')` — Data Over-Exposure (95+ instances)

- **Services ảnh hưởng**: contractService, chatService, customerService, attendanceService...
- **Hành động**: Thay `select('*')` bằng explicit column list

### M6. Console.log leak data production (70+ instances)

- **Hành động**: Dùng conditional logging hoặc loại bỏ debug logs

### M7. Error messages leak internal info

- **Hành động**: Return generic messages cho client, log chi tiết server-side

### M8. User search không escape wildcards

- **Hành động**: Áp dụng pattern sanitize: `term.replace(/[%_\\]/g, '\\$&')`

---

## 🟢 LOW — Cải thiện dần

### L1. Thiếu Input Validation Library

- Không có Zod/Yup cho form validation
- Rely hoàn toàn vào DB constraints

### L2. Dependencies — xlsx CVE

- `xlsx@^0.18.5` có CVE-2023-30533 (prototype pollution)
- Chỉ dùng export → risk thấp

### L3. .gitignore cần bổ sung

- Thiếu: `*.key`, `*.pem`, `coverage/`, `scratch/`, `public/debug.html`

### L4. Vite Dev Server mở LAN (`host: '0.0.0.0'`)

- Ai cùng mạng access được dev server (đã có sourceFileGuard)

### L5. Vercel OIDC Token trong .env.local

- Token đã hết hạn, nhưng tạo thói quen xấu

---

## ✅ Điểm tích cực (Đã làm tốt)

| # | Nội dung | Ghi chú |
|---|----------|---------|
| 1 | Email domain restriction `@cic.com.vn` | AuthContext.tsx dòng 210 |
| 2 | Google OAuth `hd: 'cic.com.vn'` | Auth.tsx dòng 55 |
| 3 | Employee verification trước đăng nhập | AuthContext.tsx dòng 253-292 |
| 4 | Source file guard plugin | vite.config.ts — chặn truy cập source files |
| 5 | `fs.deny` list cho .env, .git, scripts | vite.config.ts dòng 242-256 |
| 6 | Vercel security headers (5/7) | X-Frame-Options, X-Content-Type, etc. |
| 7 | API routes có auth + CORS check | gemini-extract.ts, recruitment-email.ts |
| 8 | Audit logging system | auditLogService.ts + DB triggers |
| 9 | Session refresh mechanism | Auto-refresh on tab visible + 3.5h interval |
| 10 | Global signout | `signOut({ scope: 'global' })` |
| 11 | RBAC + Unit-based permission design | PHANQUYENHETHONG.md + permissions.ts |
| 12 | Không dùng `eval()` | 0 instances trong app code |
| 13 | Security migration gần nhất (26/05) | Thắt chặt RLS cho profiles, tasks, HRM |

---

## 🛡️ Kế hoạch Khắc phục — 4 Giai đoạn

### Giai đoạn 1: Khẩn cấp (Ngay lập tức — 1-2 ngày)

> [!IMPORTANT]
> Các hành động này phải thực hiện NGAY vì rủi ro mất toàn bộ dữ liệu.

| # | Hành động | File/Vị trí | Effort |
|---|-----------|-------------|--------|
| 1 | 🔄 Rotate Supabase service_role key | Supabase Dashboard | 5 phút |
| 2 | Đổi `VITE_SUPABASE_SERVICE_ROLE_KEY` → `SUPABASE_SERVICE_ROLE_KEY` | `.env`, `dataClient.ts` | 30 phút |
| 3 | Xóa `VITE_DEV_PASSWORD` khỏi `.env` | `.env` | 5 phút |
| 4 | Bỏ prefix `VITE_` cho tất cả API keys AI | `.env.local` | 15 phút |
| 5 | Xóa `public/debug.html` | `public/` | 1 phút |
| 6 | Xóa hardcoded credentials từ `supabaseDefaults.ts` | `lib/supabaseDefaults.ts` | 15 phút |
| 7 | Xóa hardcoded LiteLLM key | `services/ai/gateway.ts` | 10 phút |
| 8 | DROP `exec_sql`/`execute_sql` functions | Supabase SQL Editor | 10 phút |
| 9 | Chạy `git rm --cached .env` nếu đã tracked | Git | 5 phút |

#### [MODIFY] [.env](file:///d:/CIC%20ERP/.env)
- Xóa `VITE_DEV_PASSWORD`, đổi `VITE_SUPABASE_SERVICE_ROLE_KEY` → `SUPABASE_SERVICE_ROLE_KEY`

#### [MODIFY] [.env.local](file:///d:/CIC%20ERP/.env.local)
- Đổi `VITE_DEEPSEEK_API_KEY` → `DEEPSEEK_API_KEY`, `VITE_GOOGLE_API_KEY` → `GOOGLE_API_KEY`, `VITE_OPENAI_API_KEY` → `OPENAI_API_KEY`

#### [MODIFY] [supabaseDefaults.ts](file:///d:/CIC%20ERP/lib/supabaseDefaults.ts)
- Xóa hardcoded URL + anon key, throw error nếu thiếu env vars

#### [MODIFY] [dataClient.ts](file:///d:/CIC%20ERP/lib/dataClient.ts)
- Xóa logic sử dụng `VITE_SUPABASE_SERVICE_ROLE_KEY`

#### [MODIFY] [gateway.ts](file:///d:/CIC%20ERP/services/ai/gateway.ts)
- Xóa fallback `'sk-cic-2026'`

#### [DELETE] [debug.html](file:///d:/CIC%20ERP/public/debug.html)

---

### Giai đoạn 2: Tuần này (3-5 ngày)

| # | Hành động | Effort |
|---|-----------|--------|
| 1 | Install DOMPurify, sanitize 7 instances `dangerouslySetInnerHTML` | 2h |
| 2 | Tạo RLS policies INSERT/UPDATE/DELETE cho contracts, payments, customers, employees | 4h |
| 3 | Thêm JWT auth + restrict CORS cho edge functions (ai-proxy, gemini-proxy, telegram-notify) | 3h |
| 4 | Restrict impersonation cho Admin only + audit log | 1h |
| 5 | Validate file uploads (MIME whitelist, max size) | 2h |
| 6 | Thêm CSP + HSTS headers vào vercel.json | 30m |
| 7 | Fix auth bypass khi thiếu config (gemini-extract, recruitment-email) | 1h |
| 8 | Verify social webhook signatures | 2h |

#### [NEW] [utils/sanitizeHtml.ts](file:///d:/CIC%20ERP/utils/sanitizeHtml.ts)
- Utility wrapper cho DOMPurify

#### [NEW] [supabase/migrations/YYYYMMDD_complete_rls_policies.sql](file:///d:/CIC%20ERP/supabase/migrations/)
- RLS policies cho contracts, payments, customers, employees

#### [MODIFY] [ImpersonationContext.tsx](file:///d:/CIC%20ERP/contexts/ImpersonationContext.tsx)
- Thêm role check Admin

#### [MODIFY] [vercel.json](file:///d:/CIC%20ERP/vercel.json)
- Thêm CSP, HSTS headers

#### [MODIFY] 7 component files
- Wrap `dangerouslySetInnerHTML` với `sanitizeHtml()`

---

### Giai đoạn 3: Sprint tiếp (1-2 tuần)

| # | Hành động | Effort |
|---|-----------|--------|
| 1 | Tạo server-side AI proxy (Vercel API route) cho tất cả AI calls | 1 ngày |
| 2 | Fix dev bypass flag — dùng `import.meta.env.DEV` | 30m |
| 3 | Replace `select('*')` → explicit columns (95+ instances) | 1 ngày |
| 4 | Cleanup console.log production (70+ instances) | 4h |
| 5 | Generic error messages cho client | 2h |
| 6 | Escape SQL wildcards trong search | 2h |
| 7 | Update .gitignore (thêm coverage, scratch, debug.html) | 15m |

---

### Giai đoạn 4: Dài hạn (ongoing)

| # | Hành động |
|---|-----------|
| 1 | Thêm input validation library (Zod) cho forms |
| 2 | Upgrade xlsx nếu có patch cho CVE-2023-30533 |
| 3 | Cân nhắc HttpOnly cookies cho auth |
| 4 | Security audit tự động (GitHub Actions) |
| 5 | Penetration testing định kỳ |

---

## 💾 Đề xuất Cơ chế Backup & Recovery

> [!IMPORTANT]
> Mục tiêu: Khôi phục toàn bộ dữ liệu trong **< 1 giờ** nếu bị tấn công, với **chi phí tối thiểu**.

### Chiến lược Backup 3 tầng

```mermaid
graph TB
    subgraph "Tầng 1: Supabase Built-in (FREE)"
        A["Daily Auto Backup<br/>Supabase Pro Plan"]
        B["Point-in-Time Recovery<br/>PITR - 7 ngày"]
    end
    subgraph "Tầng 2: Scheduled Export ($5-10/tháng)"
        C["pg_dump hàng ngày<br/>→ Google Cloud Storage"]
        D["Schema snapshot<br/>→ Git repository"]
    end
    subgraph "Tầng 3: Real-time Replication (Optional)"
        E["Supabase Read Replica<br/>→ Cross-region"]
    end
    
    A --> F["Recovery Time: 30 phút"]
    C --> G["Recovery Time: 1 giờ"]
    E --> H["Recovery Time: 5 phút"]
```

### Tầng 1: Supabase Built-in (MIỄN PHÍ — đã có)

**Supabase Pro Plan** (đang dùng) đã bao gồm:

| Tính năng | Chi tiết | Recovery Time |
|-----------|----------|---------------|
| **Daily Backups** | Tự động backup hàng ngày, lưu 7 ngày | 30 phút |
| **Point-in-Time Recovery (PITR)** | Khôi phục về bất kỳ thời điểm nào trong 7 ngày | 15-30 phút |

**Cách khôi phục:**
1. Vào Supabase Dashboard → Project Settings → Database → Backups
2. Chọn backup hoặc thời điểm muốn khôi phục
3. Click "Restore" → Supabase tự động restore

> [!TIP]
> **Đây là cách đơn giản nhất và hoàn toàn miễn phí nếu đang dùng Pro Plan.** PITR là phương pháp khôi phục mạnh nhất — có thể quay về bất kỳ thời điểm nào trong 7 ngày gần nhất.

### Tầng 2: Scheduled Export (Chi phí ~$5-10/tháng)

Tạo backup riêng để phòng trường hợp Supabase bị compromise hoặc account bị chiếm:

#### Phương án A: GitHub Actions + Google Cloud Storage (Khuyến nghị)

```yaml
# .github/workflows/backup.yml
name: Database Backup
on:
  schedule:
    - cron: '0 2 * * *'  # 2:00 AM UTC hàng ngày (9:00 AM VN)
  workflow_dispatch:       # Trigger thủ công khi cần

jobs:
  backup:
    runs-on: ubuntu-latest
    steps:
      - name: Install PostgreSQL client
        run: sudo apt-get install -y postgresql-client

      - name: Dump database
        env:
          PGPASSWORD: ${{ secrets.SUPABASE_DB_PASSWORD }}
        run: |
          TIMESTAMP=$(date +%Y%m%d_%H%M%S)
          pg_dump \
            -h db.jyohocjsnsyfgfsmjfqx.supabase.co \
            -U postgres \
            -d postgres \
            --no-owner --no-privileges \
            -F c \
            -f "backup_${TIMESTAMP}.dump"

      - name: Upload to Google Cloud Storage
        uses: google-github-actions/upload-cloud-storage@v2
        with:
          path: backup_*.dump
          destination: cic-erp-backups/daily/
          credentials: ${{ secrets.GCS_CREDENTIALS }}

      - name: Cleanup old backups (keep 30 days)
        run: |
          gsutil ls gs://cic-erp-backups/daily/ | \
          sort | head -n -30 | xargs -r gsutil rm
```

**Chi phí ước tính:**
- Google Cloud Storage: ~$1-2/tháng (database ~500MB × 30 bản × $0.02/GB)
- GitHub Actions: MIỄN PHÍ (repo private, 2000 phút/tháng)
- **Tổng: ~$2/tháng**

#### Phương án B: Supabase CLI + Local/NAS

```bash
# Script chạy trên máy chủ nội bộ (crontab hàng ngày)
#!/bin/bash
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="/backup/cic-erp"

# Dump database
supabase db dump --db-url "postgresql://postgres:PASSWORD@db.xxx.supabase.co:5432/postgres" \
  -f "${BACKUP_DIR}/backup_${TIMESTAMP}.sql"

# Compress
gzip "${BACKUP_DIR}/backup_${TIMESTAMP}.sql"

# Keep only 30 days
find ${BACKUP_DIR} -name "*.sql.gz" -mtime +30 -delete

# Optional: Copy to external drive
rsync -av ${BACKUP_DIR}/ /mnt/external/cic-erp-backup/
```

**Chi phí: $0** (chạy trên máy chủ nội bộ)

### Tầng 3: Schema Version Control (MIỄN PHÍ)

Backup schema (cấu trúc bảng) vào Git — không cần backup data:

```bash
# Thêm vào CI/CD hoặc chạy thủ công
supabase db dump --db-url "..." --schema-only -f supabase/schema_snapshot.sql
git add supabase/schema_snapshot.sql
git commit -m "chore: schema snapshot $(date +%Y-%m-%d)"
```

### Quy trình khôi phục khi bị tấn công

```mermaid
flowchart TD
    A["🚨 Phát hiện bị tấn công"] --> B{"Mức độ?"}
    B -->|"Dữ liệu bị sửa/xóa"| C["1. PITR (Supabase)<br/>Khôi phục về trước thời điểm tấn công"]
    B -->|"Account bị chiếm"| D["1. Đổi mật khẩu Supabase<br/>2. Rotate tất cả keys<br/>3. Restore từ external backup"]
    B -->|"Ransomware/Mã hóa"| E["1. Tạo project Supabase mới<br/>2. Import từ pg_dump backup<br/>3. Update DNS + env vars"]
    
    C --> F["2. Rotate tất cả keys<br/>(service_role, anon, API keys)"]
    D --> F
    E --> F
    
    F --> G["3. Review audit_logs<br/>Xác định scope bị ảnh hưởng"]
    G --> H["4. Patch lỗ hổng bị khai thác"]
    H --> I["5. Thông báo team + đổi password users"]
    I --> J["✅ Hệ thống hoạt động lại"]
```

### Bảng so sánh chi phí

| Phương án | Chi phí/tháng | Recovery Time | Bảo vệ |
|-----------|--------------|---------------|--------|
| Supabase PITR (đã có) | $0 (có trong Pro) | 15-30 phút | DB bị sửa/xóa |
| GitHub Actions + GCS | ~$2 | 1 giờ | Account bị chiếm |
| Local NAS backup | $0 | 1-2 giờ | Account bị chiếm |
| Schema in Git | $0 | N/A | Cấu trúc DB |
| **Tổng khuyến nghị** | **~$2/tháng** | **< 1 giờ** | **Toàn diện** |

---

## Open Questions

> [!IMPORTANT]
> **Q1**: Supabase hiện đang dùng plan gì? (Free / Pro / Team) — ảnh hưởng đến PITR availability.

> [!IMPORTANT]
> **Q2**: Các RPC functions `exec_sql`/`execute_sql` có còn cần thiết không? Nếu không, nên DROP ngay.

> [!IMPORTANT]
> **Q3**: File `public/debug.html` có đang deploy trên production không? Cần xóa ngay nếu có.

> [!WARNING]
> **Q4**: Hệ thống AI (chatbot, extract) hiện dùng API key của ai? Nếu là key công ty, cần chuyển server-side proxy. Nếu user tự nhập key cá nhân, có thể giữ client-side nhưng phải encrypt.

> [!NOTE]
> **Q5**: Team muốn ưu tiên giai đoạn nào trước? Giai đoạn 1 (khẩn cấp) nên làm ngay. Giai đoạn 2-4 có thể điều chỉnh theo sprint.

---

## Verification Plan

### Automated Tests
- Chạy `npm run build` → verify không còn VITE_ prefix cho sensitive keys
- Grep production bundle: `grep -r "service_role\|sk-cic\|Abc123456" dist/`
- Test RLS policies: tạo test user → verify không access được data ngoài scope

### Manual Verification
- Inspect production bundle trong browser DevTools → tìm keys
- Thử gọi edge functions không có JWT → verify bị reject
- Test impersonation với non-Admin user → verify bị chặn
- Thử upload file malicious → verify bị reject
