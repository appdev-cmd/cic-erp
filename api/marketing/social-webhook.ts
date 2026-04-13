export default async function handler(req: any, res: any) {
  if (req.method === 'POST') {
    // Xử lý webhook từ MXH (VD: Facebook Graph API, Zalo OA)
    const payload = req.body;
    console.log('Received social webhook payload:', payload);
    
    // Todo: Xử lý logic cập nhật dữ liệu tương tác từ MXH vào mkt_social_posts
    return res.status(200).json({ success: true, message: 'Webhook received and processed' });
  } else if (req.method === 'GET') {
    // Dành cho việc verify webhook kết nối (Ví dụ: Facebook hub.challenge)
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];
    
    // Kiểm tra token cấu hình trong môi trường
    if (mode && token) {
      if (mode === 'subscribe' && token === process.env.VITE_SOCIAL_WEBHOOK_VERIFY_TOKEN) {
        console.log('Webhook verified successfully');
        return res.status(200).send(challenge);
      } else {
        return res.status(403).json({ error: 'Forbidden: Invalid Verify Token' });
      }
    }
    return res.status(200).json({ status: 'ok', info: 'Social webhook endpoint' });
  }
  
  return res.status(405).json({ error: 'Method Not Allowed' });
}
