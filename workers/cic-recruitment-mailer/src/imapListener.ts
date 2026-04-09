import Imap from 'imap-simple';
import { simpleParser } from 'mailparser';
import { createClient } from '@supabase/supabase-js';
import { config } from './config.js';
import { parsePdfToText, extractCandidateFromJson } from './aiExtractor.js';

const supabase = createClient(config.supabaseUrl, config.supabaseKey);

async function processUnseenEmails(connection: any) {
  const searchCriteria = ['UNSEEN'];
  const fetchOptions = { bodies: ['HEADER', 'TEXT', ''], struct: true, markSeen: true };
  const messages = await connection.search(searchCriteria, fetchOptions);

  if (messages.length === 0) return;
  console.log(`📬 Found ${messages.length} unread email(s)`);

  for (const item of messages) {
    const all = item.parts.find((x: any) => x.which === '');
    if (!all) continue;

    const mail = await simpleParser(all.body);
    console.log(`📩 From: ${mail.from?.text} | Subject: ${mail.subject}`);

    // Tìm file đính kèm PDF
    const pdfAttachment = mail.attachments.find(a => a.contentType === 'application/pdf');
    if (!pdfAttachment) {
      console.log(`   ℹ️ Không có file PDF đính kèm, bỏ qua.`);
      continue;
    }

    console.log(`   📄 PDF: ${pdfAttachment.filename}`);
    const text = await parsePdfToText(pdfAttachment.content);
    console.log(`   🧠 Đang dùng AI trích xuất thông tin...`);
    const candidateData = await extractCandidateFromJson(text);
    console.log(`   📝 Kết quả:`, JSON.stringify(candidateData, null, 2));

    if (!candidateData.full_name && !candidateData.email) {
      console.log("   ⚠️ Không tách được thông tin ứng viên từ CV này.");
      continue;
    }

    const { data: cand, error: candErr } = await supabase.from('candidates').insert({
      full_name: candidateData.full_name || 'Khách Vãng Lai',
      email: candidateData.email || mail.from?.value[0]?.address,
      phone: candidateData.phone || '',
      education: candidateData.education || '',
      experience_years: candidateData.experience_years || 0,
      notes: candidateData.notes,
      tags: candidateData.skills,
      source: 'Email'
    }).select('id').single();

    if (candErr) {
      console.error("   ❌ Lỗi lưu Candidate:", candErr.message);
      continue;
    }
    console.log(`   ✅ Đã tạo ứng viên ID: ${cand.id}`);

    // Gắn vào vị trí tuyển dụng đang mở (nếu có)
    const { data: jobs } = await supabase
      .from('job_openings')
      .select('id, title')
      .eq('status', 'open')
      .limit(1);

    if (jobs && jobs.length > 0) {
      const { error: appErr } = await supabase.from('applications').insert({
        candidate_id: cand.id,
        job_opening_id: jobs[0].id,
        stage: 'applied'
      });
      if (!appErr) {
        console.log(`   🔗 Đã gắn vào vị trí: ${jobs[0].title}`);
      }
    }
  }
}

export async function startImapListener() {
  const MAX_RETRIES = 5;
  let retries = 0;

  async function connect() {
    try {
      console.log(`📡 Đang kết nối IMAP tới ${config.imap.host}...`);
      const connection = await Imap.connect({ imap: config.imap });
      await connection.openBox('INBOX');
      console.log("📥 Kết nối IMAP thành công! Đang lắng nghe email mới...");
      retries = 0; // reset khi thành công

      // Xử lý email chưa đọc hiện có
      await processUnseenEmails(connection);

      // Lắng nghe email mới
      connection.on('mail', async () => {
        try {
          await processUnseenEmails(connection);
        } catch (err) {
          console.error("❌ Lỗi xử lý email:", err);
        }
      });

      connection.on('error', (err: any) => {
        console.error("⚠️ IMAP Connection Error:", err.message);
        reconnect();
      });

      connection.on('close', () => {
        console.log("⚠️ Kết nối IMAP bị đóng, đang thử kết nối lại...");
        reconnect();
      });

    } catch (err: any) {
      console.error(`❌ IMAP Error: ${err.message}`);

      if (err.textCode === 'AUTHENTICATIONFAILED') {
        console.error("🔑 Lỗi xác thực! Kiểm tra lại EMAIL_USER và EMAIL_PASS (App Password).");
        console.error("   💡 Đảm bảo IMAP đã được bật trong Gmail Settings > Forwarding and POP/IMAP.");
      }

      reconnect();
    }
  }

  function reconnect() {
    retries++;
    if (retries > MAX_RETRIES) {
      console.error(`🛑 Đã thử ${MAX_RETRIES} lần, dừng IMAP listener. Sẽ thử lại sau 5 phút.`);
      setTimeout(() => { retries = 0; connect(); }, 5 * 60 * 1000);
      return;
    }
    const delay = Math.min(retries * 10, 60) * 1000;
    console.log(`🔄 Thử kết nối lại lần ${retries}/${MAX_RETRIES} sau ${delay / 1000}s...`);
    setTimeout(connect, delay);
  }

  await connect();
}
