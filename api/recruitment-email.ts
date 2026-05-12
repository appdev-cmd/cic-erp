import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

/**
 * Vercel Serverless Function: /api/recruitment-email
 *
 * Gửi email thông báo tuyển dụng cho ứng viên.
 * Sử dụng Resend API (HTTP native fetch).
 * Log kết quả vào bảng recruitment_email_logs.
 */

function getSupabaseAdmin() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) return null;
  return createClient(url, serviceKey, { auth: { persistSession: false } });
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

  try {
    const {
      application_id,
      candidate_id,
      stage,
      to,
      subject,
      html,
      sent_by,
      attachments
    } = req.body || {};

    // Validate required fields
    if (!to || !subject || !html) {
      return res.status(400).json({ error: 'Thiếu thông tin bắt buộc: to, subject, html' });
    }

    if (!application_id || !candidate_id) {
      return res.status(400).json({ error: 'Thiếu application_id hoặc candidate_id' });
    }

    // Auth check (optional - verify JWT if available)
    const supabaseAdmin = getSupabaseAdmin();
    const authHeader = req.headers.authorization;

    if (supabaseAdmin && authHeader) {
      const token = authHeader.replace('Bearer ', '');
      const { error: authError } = await supabaseAdmin.auth.getUser(token);
      if (authError) {
        return res.status(401).json({ error: 'Token không hợp lệ.' });
      }
    }

    // ─── Send Email via Resend API ───────────────────
    const RESEND_API_KEY = process.env.RESEND_API_KEY;
    const FROM_EMAIL = process.env.RECRUITMENT_FROM_EMAIL || 'thuongnth@cic.com.vn';
    const fromField = `"Phòng Tuyển Dụng - CIC" <${FROM_EMAIL}>`;

    let emailStatus: 'sent' | 'failed' = 'sent';
    let errorMessage: string | null = null;

    if (!RESEND_API_KEY) {
      // Mock mode — chưa có API key
      console.warn('[recruitment-email] RESEND_API_KEY chưa cấu hình. Chạy mock mode.');
      emailStatus = 'sent'; // Vẫn log là sent trong mock mode
      errorMessage = 'MOCK: API key chưa được cấu hình, email không thực sự gửi.';
    } else {
      try {
        const resendRes = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${RESEND_API_KEY}`
          },
          body: JSON.stringify({
            from: fromField,
            to: Array.isArray(to) ? to : [to],
            subject: subject,
            html: html,
            ...(attachments && attachments.length > 0 ? { attachments } : {})
          })
        });

        if (!resendRes.ok) {
          const errText = await resendRes.text();
          console.error('[recruitment-email] Resend error:', resendRes.status, errText);
          emailStatus = 'failed';
          errorMessage = `Resend API ${resendRes.status}: ${errText.substring(0, 200)}`;
        }
      } catch (sendErr: any) {
        console.error('[recruitment-email] Send error:', sendErr);
        emailStatus = 'failed';
        errorMessage = sendErr.message || 'Unknown send error';
      }
    }

    // ─── Log to Database ─────────────────────────────
    if (supabaseAdmin) {
      const { error: logError } = await supabaseAdmin
        .from('recruitment_email_logs')
        .insert({
          application_id,
          candidate_id,
          stage: stage || 'unknown',
          email_to: Array.isArray(to) ? to.join(', ') : to,
          email_subject: subject,
          email_html: html,
          status: emailStatus,
          error_message: errorMessage,
          sent_at: emailStatus === 'sent' ? new Date().toISOString() : null,
          sent_by: sent_by || null
        });

      if (logError) {
        console.error('[recruitment-email] Log insert error:', logError.message);
      }
    }

    // ─── Response ────────────────────────────────────
    if (emailStatus === 'failed') {
      return res.status(500).json({
        success: false,
        error: errorMessage || 'Gửi email thất bại'
      });
    }

    return res.status(200).json({
      success: true,
      mock: !RESEND_API_KEY,
      message: RESEND_API_KEY
        ? 'Email đã được gửi thành công.'
        : 'Mock mode: Email chưa thực sự gửi (thiếu RESEND_API_KEY).'
    });

  } catch (error: any) {
    console.error('[recruitment-email] Server error:', error);
    return res.status(500).json({ error: error.message || 'Internal Server Error' });
  }
}
