export interface SendEmailParams {
  to: string | string[];
  subject: string;
  html: string;
  from?: string; // Tên hiển thị người gửi (Ví dụ: "CIC Marketing")
}

/**
 * Gửi email sử dụng Resend (hoặc SendGrid/SMTP API tương tự)
 * Phục vụ cho Marketing Automation, Notification và Newsletter.
 */
export async function sendEmail({ to, subject, html, from }: SendEmailParams) {
  // Ưu tiên đọc từ biến môi trường VITE_ hoặc process.env tiêu chuẩn (Node.js/Next)
  const API_KEY = process.env.VITE_RESEND_API_KEY || process.env.RESEND_API_KEY;
  const FROM_EMAIL = process.env.VITE_MARKETING_EMAIL || 'marketing@cic.com.vn';
  const fromName = from ? `${from} <${FROM_EMAIL}>` : `CIC Corporation <${FROM_EMAIL}>`;
  
  // Nếu chưa cấu hình Key, chạy ở chế độ Mock
  if (!API_KEY) {
    console.warn(`[EmailSender] Missing API Key. Simulate sending email to: ${to}`);
    // Simulate latency
    await new Promise(r => setTimeout(r, 600));
    return { success: true, mocked: true, message: 'Mock email sent. Missing API key.'};
  }

  try {
    const toArray = Array.isArray(to) ? to : [to];
    
    // Giao tiếp qua Resend API HTTP (Native fetch, không cần import thư viện resend)
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${API_KEY}`
      },
      body: JSON.stringify({
        from: fromName,
        to: toArray,
        subject: subject,
        html: html
      })
    });

    if (!res.ok) {
      const errorText = await res.text();
      throw new Error(`Resend API Error: ${res.status} - ${errorText}`);
    }

    const data = await res.json();
    return { success: true, data };
  } catch (error: any) {
    console.error('[EmailSender] Failed to send email:', error);
    return { success: false, error: error.message };
  }
}
