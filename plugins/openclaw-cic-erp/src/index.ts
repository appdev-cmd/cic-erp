/**
 * OpenClaw plugin — CIC ERP qua Supabase RPC (cùng hàm với bot cic-telegram-openclaw).
 * Chat ID: ưu tiên requesterSenderId (Telegram), sau đó tham số, sau đó defaultTelegramChatId.
 */
import { definePluginEntry } from "openclaw/plugin-sdk/plugin-entry";
import { Type } from "@sinclair/typebox";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/** Ngữ cảnh tool do OpenClaw inject (Telegram → requesterSenderId) */
type ToolCtx = {
  requesterSenderId?: string;
  runtimeConfig?: unknown;
  config?: unknown;
};

type CicConfig = {
  supabaseUrl?: string;
  supabaseServiceRoleKey?: string;
  defaultTelegramChatId?: string;
};

function entryConfig(api: { pluginConfig?: Record<string, unknown> }): CicConfig {
  return (api.pluginConfig ?? {}) as CicConfig;
}

function runtimeEntryConfig(ctx: ToolCtx): CicConfig {
  type Cfg = { plugins?: { entries?: Record<string, { config?: CicConfig }> } };
  const cfg = (ctx.runtimeConfig ?? ctx.config) as Cfg | undefined;
  return cfg?.plugins?.entries?.["cic-erp"]?.config ?? {};
}

function resolveCreds(apiCfg: CicConfig, rtCfg: CicConfig): { url: string; key: string } {
  const url =
    rtCfg.supabaseUrl ??
    apiCfg.supabaseUrl ??
    process.env.CIC_ERP_SUPABASE_URL ??
    "";
  const key =
    rtCfg.supabaseServiceRoleKey ??
    apiCfg.supabaseServiceRoleKey ??
    process.env.CIC_ERP_SUPABASE_SERVICE_ROLE_KEY ??
    "";
  return { url, key };
}

function textResult(text: string) {
  return { content: [{ type: "text" as const, text }] };
}

function makeSb(url: string, key: string): SupabaseClient {
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export default definePluginEntry({
  id: "cic-erp",
  name: "CIC ERP",
  description: "Truy vấn CIC ERP (Supabase RPC) — hợp đồng, doanh thu, công nợ, task",
  register(api) {
    const apiCfg = entryConfig(api);

    const resolveChatId = (ctx: ToolCtx, param?: string): string | undefined => {
      const rt = runtimeEntryConfig(ctx);
      const id =
        (param && String(param).trim()) ||
        ctx.requesterSenderId ||
        rt.defaultTelegramChatId ||
        apiCfg.defaultTelegramChatId;
      return id ? String(id) : undefined;
    };

    async function requireEmployeeId(ctx: ToolCtx, telegramChatId: string): Promise<string> {
      const { url, key } = resolveCreds(apiCfg, runtimeEntryConfig(ctx));
      if (!url || !key) {
        throw new Error(
          "Thiếu supabaseUrl/supabaseServiceRoleKey trong plugins.entries.cic-erp.config hoặc env CIC_ERP_SUPABASE_URL / CIC_ERP_SUPABASE_SERVICE_ROLE_KEY",
        );
      }
      const sb = makeSb(url, key);
      const { data, error } = await sb.rpc("telegram_bot_resolve_context", {
        p_telegram_chat_id: String(telegramChatId),
      });
      if (error) throw new Error(error.message);
      const row = Array.isArray(data) ? data[0] : data;
      if (!row || !(row as { ok?: boolean }).ok) {
        const msg = (row as { error_message?: string })?.error_message;
        throw new Error(msg ?? "Telegram chưa liên kết hoặc chưa xác thực trên CIC ERP.");
      }
      return String((row as { employee_id: string }).employee_id);
    }

    async function withEmployee<T>(
      ctx: ToolCtx,
      params: Record<string, unknown>,
      fn: (sb: SupabaseClient, employeeId: string) => Promise<T>,
    ): Promise<T> {
      const chat = resolveChatId(ctx, params.telegram_chat_id as string | undefined);
      if (!chat) {
        throw new Error(
          "Thiếu telegram_chat_id. Trên Telegram OpenClaw thường tự điền requesterSenderId; WebChat/CLI cần truyền hoặc defaultTelegramChatId trong config plugin.",
        );
      }
      const { url, key } = resolveCreds(apiCfg, runtimeEntryConfig(ctx));
      if (!url || !key) {
        throw new Error("Thiếu cấu hình Supabase cho plugin cic-erp.");
      }
      const employeeId = await requireEmployeeId(ctx, chat);
      const sb = makeSb(url, key);
      return fn(sb, employeeId);
    }

    const optChat = Type.Optional(
      Type.String({
        description:
          "Telegram chat id (số). Để trống trên kênh Telegram — hệ thống dùng người gửi hiện tại.",
      }),
    );

    api.registerTool((ctx) => ({
      name: "cic_erp_resolve_context",
      description: "Xác thực Telegram ↔ nhân viên ERP (telegram_verified).",
      parameters: Type.Object({ telegram_chat_id: optChat }),
      async execute(_id, params: Record<string, unknown>) {
        try {
          const chat = resolveChatId(ctx, params.telegram_chat_id as string | undefined);
          if (!chat) {
            return textResult(
              JSON.stringify({ ok: false, error: "Thiếu telegram_chat_id / requesterSenderId." }),
            );
          }
          const { url, key } = resolveCreds(apiCfg, runtimeEntryConfig(ctx));
          if (!url || !key) {
            return textResult(JSON.stringify({ ok: false, error: "Thiếu cấu hình Supabase." }));
          }
          const sb = makeSb(url, key);
          const { data, error } = await sb.rpc("telegram_bot_resolve_context", {
            p_telegram_chat_id: chat,
          });
          if (error) return textResult(JSON.stringify({ ok: false, error: error.message }));
          return textResult(JSON.stringify({ ok: true, data }, null, 2));
        } catch (e) {
          return textResult(
            JSON.stringify({ ok: false, error: e instanceof Error ? e.message : String(e) }),
          );
        }
      },
    }));

    api.registerTool((ctx) => ({
      name: "cic_erp_dashboard",
      description: "Tổng quan ERP: số HĐ, giá trị, phải thu, đã thu, quá hạn, task.",
      parameters: Type.Object({ telegram_chat_id: optChat }),
      async execute(_id, params: Record<string, unknown>) {
        try {
          const data = await withEmployee(ctx, params, async (sb, employeeId) => {
            const { data: d, error } = await sb.rpc("telegram_bot_dashboard", {
              p_employee_id: employeeId,
            });
            if (error) throw new Error(error.message);
            return d;
          });
          return textResult(JSON.stringify(data, null, 2));
        } catch (e) {
          return textResult(JSON.stringify({ error: e instanceof Error ? e.message : String(e) }));
        }
      },
    }));

    api.registerTool((ctx) => ({
      name: "cic_erp_contracts_report",
      description: "Danh sách hợp đồng (RPC báo cáo), lọc from/to YYYY-MM-DD, limit tối đa 500.",
      parameters: Type.Object({
        telegram_chat_id: optChat,
        from: Type.Optional(Type.String()),
        to: Type.Optional(Type.String()),
        limit: Type.Optional(Type.Number()),
      }),
      async execute(_id, params: Record<string, unknown>) {
        try {
          const data = await withEmployee(ctx, params, async (sb, employeeId) => {
            const limit = Math.min(Number(params.limit) || 200, 500);
            const { data: d, error } = await sb.rpc("telegram_bot_contracts_report", {
              p_employee_id: employeeId,
              p_from: params.from ? String(params.from) : null,
              p_to: params.to ? String(params.to) : null,
              p_limit: limit,
            });
            if (error) throw new Error(error.message);
            return d;
          });
          return textResult(JSON.stringify(data, null, 2));
        } catch (e) {
          return textResult(JSON.stringify({ error: e instanceof Error ? e.message : String(e) }));
        }
      },
    }));

    api.registerTool((ctx) => ({
      name: "cic_erp_overdue_payments",
      description: "Thanh toán quá hạn (theo quyền RPC).",
      parameters: Type.Object({ telegram_chat_id: optChat }),
      async execute(_id, params: Record<string, unknown>) {
        try {
          const data = await withEmployee(ctx, params, async (sb, employeeId) => {
            const { data: d, error } = await sb.rpc("telegram_bot_overdue_payments", {
              p_employee_id: employeeId,
            });
            if (error) throw new Error(error.message);
            return d;
          });
          return textResult(JSON.stringify(data, null, 2));
        } catch (e) {
          return textResult(JSON.stringify({ error: e instanceof Error ? e.message : String(e) }));
        }
      },
    }));

    api.registerTool((ctx) => ({
      name: "cic_erp_expiring_contracts",
      description: "Hợp đồng sắp hết hạn trong N ngày (mặc định 30).",
      parameters: Type.Object({
        telegram_chat_id: optChat,
        days: Type.Optional(Type.Number()),
      }),
      async execute(_id, params: Record<string, unknown>) {
        try {
          const data = await withEmployee(ctx, params, async (sb, employeeId) => {
            const days = Number(params.days) || 30;
            const { data: d, error } = await sb.rpc("telegram_bot_expiring_contracts", {
              p_employee_id: employeeId,
              p_days: days,
            });
            if (error) throw new Error(error.message);
            return d;
          });
          return textResult(JSON.stringify(data, null, 2));
        } catch (e) {
          return textResult(JSON.stringify({ error: e instanceof Error ? e.message : String(e) }));
        }
      },
    }));

    api.registerTool((ctx) => ({
      name: "cic_erp_my_tasks",
      description: "Task được giao cho nhân viên hiện tại.",
      parameters: Type.Object({ telegram_chat_id: optChat }),
      async execute(_id, params: Record<string, unknown>) {
        try {
          const data = await withEmployee(ctx, params, async (sb, employeeId) => {
            const { data: d, error } = await sb.rpc("telegram_bot_my_tasks", {
              p_employee_id: employeeId,
            });
            if (error) throw new Error(error.message);
            return d;
          });
          return textResult(JSON.stringify(data, null, 2));
        } catch (e) {
          return textResult(JSON.stringify({ error: e instanceof Error ? e.message : String(e) }));
        }
      },
    }));

    api.registerTool((ctx) => ({
      name: "cic_erp_search_contracts",
      description: "Tìm hợp đồng theo từ khóa (tên, mã, KH...).",
      parameters: Type.Object({
        telegram_chat_id: optChat,
        keyword: Type.String(),
      }),
      async execute(_id, params: Record<string, unknown>) {
        try {
          const kw = String(params.keyword ?? "").trim();
          if (kw.length < 2) {
            return textResult(JSON.stringify({ error: "keyword cần ít nhất 2 ký tự" }));
          }
          const data = await withEmployee(ctx, params, async (sb, employeeId) => {
            const { data: d, error } = await sb.rpc("telegram_bot_search_contracts", {
              p_employee_id: employeeId,
              p_keyword: kw,
            });
            if (error) throw new Error(error.message);
            return d;
          });
          return textResult(JSON.stringify(data, null, 2));
        } catch (e) {
          return textResult(JSON.stringify({ error: e instanceof Error ? e.message : String(e) }));
        }
      },
    }));

    api.registerTool((ctx) => ({
      name: "cic_erp_revenue_by_month",
      description: "Doanh thu / giá trị theo tháng (year có thể để trống = năm hiện tại theo RPC).",
      parameters: Type.Object({
        telegram_chat_id: optChat,
        year: Type.Optional(Type.Number()),
      }),
      async execute(_id, params: Record<string, unknown>) {
        try {
          const data = await withEmployee(ctx, params, async (sb, employeeId) => {
            const { data: d, error } = await sb.rpc("telegram_bot_revenue_by_month", {
              p_employee_id: employeeId,
              p_year: params.year != null ? Number(params.year) : null,
            });
            if (error) throw new Error(error.message);
            return d;
          });
          return textResult(JSON.stringify(data, null, 2));
        } catch (e) {
          return textResult(JSON.stringify({ error: e instanceof Error ? e.message : String(e) }));
        }
      },
    }));
  },
});
