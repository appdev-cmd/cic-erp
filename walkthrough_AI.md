# Walkthrough: AI Security Hardening — CIC ERP

## Tổng quan
Rà soát toàn bộ hệ thống AI và xử lý **28+ vấn đề** trên **12 file sửa + 1 migration SQL mới**.

---

## 🔴 Nhóm A: Bảo mật (CRITICAL)

### [gateway.ts](file:///d:/CIC%20ERP/services/ai/gateway.ts)
| # | Thay đổi | Chi tiết |
|---|----------|----------|
| 1 | Xóa hardcoded API key | `sk-cic-2026` → `''` (dòng 30) |
| 2 | Đổi header impersonation | `X-Impersonate-User` → `X-Request-User-Id` (2 chỗ) |
| 3 | Tăng max_tokens local | `3000` → `8000` (2 chỗ) |
| 4 | Cải thiện token estimation | `/ 4` → `/ 2.5` (chính xác hơn cho tiếng Việt) |
| 5 | Giảm preview length | `500` → `300` ký tự |

### [ragService.ts](file:///d:/CIC%20ERP/services/ragService.ts)
| # | Thay đổi | Chi tiết |
|---|----------|----------|
| 1 | API key từ URL → header | `?key=` → `x-goog-api-key` header |
| 2 | Xóa hardcoded key | `sk-cic-2026` → `''` |
| 3 | Thêm fallback log | Log khi Gemini fallback thành công |

### [chatService.ts](file:///d:/CIC%20ERP/services/chatService.ts)
| # | Thay đổi |
|---|----------|
| 1 | Thêm `TODO: SECURITY` comment cho `dangerouslyAllowBrowser` |

### [aiChatHistoryService.ts](file:///d:/CIC%20ERP/services/aiChatHistoryService.ts)
| # | Thay đổi |
|---|----------|
| 1 | `deleteConversation` — thêm owner validation |
| 2 | `updateConversation` — thêm owner-scoped update |

### [AIAssistant.tsx](file:///d:/CIC%20ERP/components/AIAssistant.tsx)
| # | Thay đổi |
|---|----------|
| 1 | Xóa 2× `sk-cic-2026` hardcoded key |
| 2 | Xóa 3× `Dev` role backdoor |

### [EmbeddingSettings.tsx](file:///d:/CIC%20ERP/components/settings/EmbeddingSettings.tsx)
| # | Thay đổi |
|---|----------|
| 1 | Xóa `sk-cic-2026` hardcoded key |

### [erpReactAgent.ts](file:///d:/CIC%20ERP/workers/cic-telegram-openclaw/src/agent/erpReactAgent.ts)
| # | Thay đổi |
|---|----------|
| 1 | `sk-cic-2026` → `config.ollamaApiKey` từ env |

### [config.ts](file:///d:/CIC%20ERP/workers/cic-telegram-openclaw/src/config.ts)
| # | Thay đổi |
|---|----------|
| 1 | Thêm `ollamaApiKey` từ `OLLAMA_API_KEY` env var |

---

## 🟠 Nhóm B: Phân quyền

### [toolAcl.ts](file:///d:/CIC%20ERP/services/ai/openclaw/toolAcl.ts)
| # | Thay đổi |
|---|----------|
| 1 | Thêm `BackOffice` constant |
| 2 | Thêm `BackOffice` vào `GLOBAL_ROLES` |
| 3 | Thêm `BackOffice` vào `FINANCE_ROLES` |
| 4 | Thêm `BackOffice` vào `HR_ROLES` |

### [permissionGuard.ts](file:///d:/CIC%20ERP/services/ai/openclaw/permissionGuard.ts)
| # | Thay đổi |
|---|----------|
| 1 | Import `GLOBAL_VIEW_ROLES` từ `lib/permissions.ts` (single source of truth) |
| 2 | Xóa hardcoded `GLOBAL_ROLES` array cục bộ |

### [router.ts](file:///d:/CIC%20ERP/services/ai/openclaw/router.ts)
| # | Thay đổi |
|---|----------|
| 1 | Xóa `Dev` role khỏi admin check |
| 2 | Thêm `userId` fallback cho `allowedUsers` matching |

---

## 🟡 Nhóm C: Logic & Hiệu suất

### [contextService.ts](file:///d:/CIC%20ERP/services/contextService.ts)
| # | Thay đổi |
|---|----------|
| 1 | Thêm `PERF:` / `TODO:` comment cho query tối ưu hóa |
| 2 | Thêm cache TTL notice trong context report |

### [agentConfigService.ts](file:///d:/CIC%20ERP/services/ai/agentConfigService.ts)
| # | Thay đổi |
|---|----------|
| 1 | Không ghi đè `allowed_tools` khi sync nếu admin đã custom |

### [aiPermissionService.ts](file:///d:/CIC%20ERP/services/aiPermissionService.ts)
| # | Thay đổi |
|---|----------|
| 1 | Auto-reset quota hàng tháng trong `getMyPermission()` |
| 2 | Thêm `is_locked`, `locked_reason`, `locked_at` vào interface |
| 3 | Lock check + auto-lock tại 150% quota trong `incrementUsage()` |

### [react-loop.ts](file:///d:/CIC%20ERP/services/ai/openclaw/react-loop.ts)
| # | Thay đổi |
|---|----------|
| 1 | Rút gọn system prompt ~40% (834→512 bytes) — tiết kiệm token mỗi lượt gọi |

---

## 🔵 Nhóm D: Database

### [NEW] [20260527_ai_security_hardening.sql](file:///d:/CIC%20ERP/supabase/migrations/20260527_ai_security_hardening.sql)
| # | Nội dung |
|---|----------|
| 1 | Enable RLS trên 5 bảng AI |
| 2 | Policies cho `ai_conversations` (CRUD chỉ owner) |
| 3 | Policies cho `ai_messages` (qua FK conversation) |
| 4 | Policies cho `ai_logs` (owner + admin) |
| 5 | Policies cho `ai_permissions` (owner read, admin full) |
| 6 | Policies cho `agent_memories` (CRUD chỉ owner) |
| 7 | Thêm 3 cột `is_locked`, `locked_reason`, `locked_at` |
| 8 | Function `reset_ai_monthly_quotas()` |
| 9 | Hướng dẫn pg_cron cho auto-reset hàng tháng |

---

## ⚠️ Hành động thủ công cần làm

> [!IMPORTANT]
> 1. **Rotate API key** `sk-cic-2026` — key này đã bị lộ trong source code. Tạo key mới trên LiteLLM dashboard và cập nhật vào `.env` / `.env.local`
> 2. **Chạy SQL migration** trên Supabase Dashboard → SQL Editor
> 3. **Set `OLLAMA_API_KEY`** trong `.env` của Telegram worker
> 4. **Cân nhắc** triển khai Edge Function proxy để thay thế `dangerouslyAllowBrowser` trong chatService.ts

## Kiểm tra
- ✅ TypeScript build: Không phát sinh lỗi mới (chỉ lỗi pre-existing không liên quan)
- ✅ Grep `sk-cic-2026`: Chỉ còn 2 file test/scratch (không phải production)
- ✅ Grep `'Dev'` role: Sạch hoàn toàn trong .ts/.tsx
