# OpenClaw plugin: CIC ERP

Plugin chính thức cho [OpenClaw](https://docs.openclaw.ai/) — đăng ký **tool** gọi các RPC `telegram_bot_*` trên Supabase (cùng lớp bảo mật với bot `cic-telegram-openclaw`).

## Yêu cầu

- OpenClaw Gateway (CLI `openclaw`), Node **≥ 22** (theo tài liệu plugin).
- Dự án Supabase đã chạy migration RPC bot (`telegram_bot_resolve_context`, `telegram_bot_dashboard`, …).
- Nhân viên có `telegram` + `telegram_verified = true` trong ERP.

## Cài plugin (dev — link local)

```bash
cd /đường/dẫn/cic-erp/plugins/openclaw-cic-erp
npm install
openclaw plugins install -l "$(pwd)"
openclaw gateway restart
```

Hoặc cài bản copy (không link):

```bash
openclaw plugins install /đường/dẫn/cic-erp/plugins/openclaw-cic-erp
```

## Cấu hình `~/.openclaw/openclaw.json` (JSON5)

Thêm (chỉnh tên agent theo máy bạn):

```json5
{
  plugins: {
    enabled: true,
    allow: ["cic-erp"],
    entries: {
      "cic-erp": {
        enabled: true,
        config: {
          supabaseUrl: "https://YOUR.supabase.co",
          supabaseServiceRoleKey: "eyJ...", // chỉ trên gateway tin cậy
          // defaultTelegramChatId: "5156059305", // tuỳ chọn: WebChat / CLI
        },
      },
    },
  },
  // Lưu ý: không đặt tools dưới agents.defaults (OpenClaw báo Unrecognized key).
  agents: {
    list: [
      {
        id: "main",
        tools: {
          allow: ["group:plugins", "cic-erp"],
        },
      },
    ],
  },
}
```

**Bí mật:** nên dùng cơ chế SecretRef của OpenClaw nếu có (không dán key thẳng vào file được commit).

## Biến môi trường (tuỳ chọn)

Nếu không đặt trong `plugins.entries.cic-erp.config`:

- `CIC_ERP_SUPABASE_URL`
- `CIC_ERP_SUPABASE_SERVICE_ROLE_KEY`

## Telegram chat id

Trên kênh **Telegram** do OpenClaw quản lý, tool thường nhận `requesterSenderId` — **không cần** truyền `telegram_chat_id`.

Trên **WebChat** hoặc CLI: truyền `telegram_chat_id` vào tool, hoặc set `defaultTelegramChatId` trong config plugin.

## Tool đăng ký

| Tool | Mô tả |
|------|--------|
| `cic_erp_resolve_context` | Kiểm tra liên kết Telegram ↔ ERP |
| `cic_erp_dashboard` | Tổng quan |
| `cic_erp_contracts_report` | Danh sách HĐ (from/to/limit) |
| `cic_erp_overdue_payments` | Quá hạn thanh toán |
| `cic_erp_expiring_contracts` | Sắp hết hạn (days) |
| `cic_erp_my_tasks` | Task của user |
| `cic_erp_search_contracts` | Tìm theo keyword |
| `cic_erp_revenue_by_month` | Doanh thu theo tháng (year) |

## Worker `cic-telegram-openclaw`

Có thể **giữ** làm webhook/Edge proxy cũ, hoặc **chuyển hẳn** sang OpenClaw Telegram channel — không cần cả hai nếu đã dùng gateway OpenClaw + plugin này.

## Tài liệu OpenClaw

- [Building plugins](https://docs.openclaw.ai/plugins/building-plugins)
- [Plugins CLI](https://docs.openclaw.ai/tools/plugin)
- [Telegram channel](https://docs.openclaw.ai/channels/telegram.md)
