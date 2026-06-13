import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

/**
 * Vercel Serverless Function: /api/gemini-extract
 *
 * Proxy Gemini API calls từ client → server-side.
 * 1. Verify JWT từ Supabase Auth
 * 2. Check ai_permissions.can_use_system_api
 * 3. Check quota
 * 4. Gọi Gemini API với GEMINI_API_KEY từ env
 * 5. Tăng usage_count
 */

// Supabase Admin client (dùng service_role key để bypass RLS)
function getSupabaseAdmin() {
    const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !serviceKey) return null;
    return createClient(url, serviceKey, { auth: { persistSession: false } });
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
    // CORS — restrict to production domain
    const allowedOrigins = ['https://cic-erp.vercel.app', 'https://erp.cic.com.vn', 'http://localhost:5173', 'http://localhost:5174'];
    const origin = req.headers.origin || '';
    const corsOrigin = allowedOrigins.includes(origin) ? origin : allowedOrigins[0];
    res.setHeader('Access-Control-Allow-Origin', corsOrigin);
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

    try {
        const apiKey = process.env.GEMINI_API_KEY || process.env.VITE_GOOGLE_API_KEY;
        if (!apiKey) {
            return res.status(500).json({ error: 'GEMINI_API_KEY chưa được cấu hình trên server.' });
        }

        // ─── Auth Check ──────────────────────────────────
        const authHeader = req.headers.authorization;
        const supabaseAdmin = getSupabaseAdmin();

        if (supabaseAdmin && authHeader) {
            const token = authHeader.replace('Bearer ', '');

            // Verify JWT
            const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
            if (authError || !user) {
                return res.status(401).json({ error: 'Token không hợp lệ. Vui lòng đăng nhập lại.' });
            }

            // Check AI permission
            const { data: perm } = await supabaseAdmin
                .from('ai_permissions')
                .select('can_use_system_api, monthly_quota, usage_count')
                .eq('user_id', user.id)
                .maybeSingle();

            // Check if user is Admin (always allowed)
            const { data: profile } = await supabaseAdmin
                .from('profiles')
                .select('role')
                .eq('id', user.id)
                .maybeSingle();

            const isAdmin = profile?.role === 'Admin';

            if (!isAdmin) {
                if (!perm || !perm.can_use_system_api) {
                    return res.status(403).json({
                        error: 'Bạn chưa được cấp quyền sử dụng API hệ thống. Vui lòng liên hệ Admin hoặc sử dụng API key cá nhân.',
                        code: 'NO_SYSTEM_API_ACCESS',
                    });
                }

                // Check quota (0 = unlimited)
                if (perm.monthly_quota > 0 && perm.usage_count >= perm.monthly_quota) {
                    return res.status(429).json({
                        error: `Bạn đã hết quota AI trong tháng này (${perm.usage_count}/${perm.monthly_quota}). Vui lòng dùng API key cá nhân hoặc liên hệ Admin.`,
                        code: 'QUOTA_EXCEEDED',
                    });
                }
            }

            // Increment usage
            await supabaseAdmin
                .from('ai_permissions')
                .update({ usage_count: (perm?.usage_count || 0) + 1, updated_at: new Date().toISOString() })
                .eq('user_id', user.id);

        } else if (supabaseAdmin && !authHeader) {
            // If supabase is configured but no auth header → reject
            return res.status(401).json({ error: 'Missing Authorization header.' });
        }
        // If supabaseAdmin is null (no SUPABASE_SERVICE_ROLE_KEY), allow without auth (dev mode)

        // ─── Call Gemini ─────────────────────────────────
        const { parts, maxTokens = 8192, temperature = 0.1, model = 'gemini-3.5-flash' } = req.body || {};

        if (!parts || !Array.isArray(parts) || parts.length === 0) {
            return res.status(400).json({ error: 'Missing or invalid "parts" in request body' });
        }

        const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

        const geminiRes = await fetch(geminiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts }],
                generationConfig: { temperature, maxOutputTokens: maxTokens },
            }),
        });

        if (!geminiRes.ok) {
            const errText = await geminiRes.text();
            console.error('[gemini-extract] Gemini API error:', geminiRes.status, errText.substring(0, 300));
            return res.status(geminiRes.status).json({
                error: `Gemini API: ${geminiRes.status} - ${errText.substring(0, 200)}`,
            });
        }

        const geminiJson = await geminiRes.json();
        const text = geminiJson?.candidates?.[0]?.content?.parts?.[0]?.text || '';

        return res.status(200).json({ text });
    } catch (error: any) {
        console.error('[gemini-extract] Server error:', error);
        return res.status(500).json({ error: error.message || 'Internal Server Error' });
    }
}
