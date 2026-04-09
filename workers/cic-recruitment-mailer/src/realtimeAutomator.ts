import { createClient, RealtimePostgresUpdatePayload } from '@supabase/supabase-js';
import nodemailer from 'nodemailer';
import { config } from './config.js';

const supabase = createClient(config.supabaseUrl, config.supabaseKey);
const transporter = nodemailer.createTransport(config.smtp);

// Verify SMTP connection on startup
transporter.verify()
  .then(() => console.log("✅ SMTP connection verified"))
  .catch((err) => console.error("❌ SMTP verification failed:", err.message));

const emailTemplates: Record<string, (name: string, jobTitle?: string) => { subject: string; html: string }> = {
  screening: (name, jobTitle) => ({
    subject: `[CIC] Xác nhận nhận hồ sơ ứng tuyển${jobTitle ? ' - ' + jobTitle : ''}`,
    html: `
      <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: #1a1a2e; color: white; padding: 20px 30px; border-radius: 8px 8px 0 0;">
          <h2 style="margin: 0;">CIC - Phòng Tuyển Dụng</h2>
        </div>
        <div style="padding: 25px 30px; background: #f8f9fa; border: 1px solid #e9ecef;">
          <p>Chào <b>${name}</b>,</p>
          <p>Cảm ơn bạn đã quan tâm và nộp hồ sơ ứng tuyển${jobTitle ? ' vào vị trí <b>' + jobTitle + '</b>' : ''} tại công ty chúng tôi.</p>
          <p>Hồ sơ của bạn đã được tiếp nhận thành công và đang trong giai đoạn <b>Sàng lọc CV</b>. Chúng tôi sẽ liên hệ lại với bạn trong thời gian sớm nhất.</p>
          <p style="color: #666; font-size: 13px; margin-top: 30px;">Trân trọng,<br><b>Phòng Nhân Sự - CIC</b></p>
        </div>
      </div>`
  }),
  interview_1: (name, jobTitle) => ({
    subject: `[CIC] Thư mời Phỏng vấn Vòng 1${jobTitle ? ' - ' + jobTitle : ''}`,
    html: `
      <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: #0f3460; color: white; padding: 20px 30px; border-radius: 8px 8px 0 0;">
          <h2 style="margin: 0;">🎉 Chúc mừng!</h2>
        </div>
        <div style="padding: 25px 30px; background: #f8f9fa; border: 1px solid #e9ecef;">
          <p>Chào <b>${name}</b>,</p>
          <p>Sau quá trình sàng lọc, chúng tôi rất vui thông báo bạn đã <b style="color: #28a745;">vượt qua vòng hồ sơ</b>${jobTitle ? ' cho vị trí <b>' + jobTitle + '</b>' : ''}.</p>
          <p>Chúng tôi sẽ sớm liên hệ để sắp xếp lịch phỏng vấn Vòng 1 phù hợp với bạn.</p>
          <p>Vui lòng kiểm tra email thường xuyên hoặc giữ điện thoại liên lạc nhé.</p>
          <p style="color: #666; font-size: 13px; margin-top: 30px;">Trân trọng,<br><b>Phòng Nhân Sự - CIC</b></p>
        </div>
      </div>`
  }),
  interview_2: (name, jobTitle) => ({
    subject: `[CIC] Thư mời Phỏng vấn Vòng 2${jobTitle ? ' - ' + jobTitle : ''}`,
    html: `
      <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: #533483; color: white; padding: 20px 30px; border-radius: 8px 8px 0 0;">
          <h2 style="margin: 0;">🚀 Tiếp tục hành trình!</h2>
        </div>
        <div style="padding: 25px 30px; background: #f8f9fa; border: 1px solid #e9ecef;">
          <p>Chào <b>${name}</b>,</p>
          <p>Chúc mừng bạn đã hoàn thành xuất sắc Vòng Phỏng vấn 1! Chúng tôi mời bạn tiếp tục tham gia <b>Phỏng vấn Vòng 2</b>.</p>
          <p>Chi tiết lịch phỏng vấn sẽ được gửi riêng qua email hoặc điện thoại.</p>
          <p style="color: #666; font-size: 13px; margin-top: 30px;">Trân trọng,<br><b>Phòng Nhân Sự - CIC</b></p>
        </div>
      </div>`
  }),
  technical_test: (name, jobTitle) => ({
    subject: `[CIC] Thư mời làm bài Test kỹ thuật${jobTitle ? ' - ' + jobTitle : ''}`,
    html: `
      <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: #e94560; color: white; padding: 20px 30px; border-radius: 8px 8px 0 0;">
          <h2 style="margin: 0;">📝 Bài kiểm tra kỹ thuật</h2>
        </div>
        <div style="padding: 25px 30px; background: #f8f9fa; border: 1px solid #e9ecef;">
          <p>Chào <b>${name}</b>,</p>
          <p>Bạn đã được mời tham gia <b>bài kiểm tra kỹ thuật</b>${jobTitle ? ' cho vị trí <b>' + jobTitle + '</b>' : ''}.</p>
          <p>Thông tin chi tiết về bài test (link, thời gian, yêu cầu) sẽ được gửi riêng trong email tiếp theo.</p>
          <p style="color: #666; font-size: 13px; margin-top: 30px;">Trân trọng,<br><b>Phòng Nhân Sự - CIC</b></p>
        </div>
      </div>`
  }),
  offer: (name, jobTitle) => ({
    subject: `[CIC] 🎊 THƯ MỜI NHẬN VIỆC (Offer Letter)${jobTitle ? ' - ' + jobTitle : ''}`,
    html: `
      <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 25px 30px; border-radius: 8px 8px 0 0;">
          <h2 style="margin: 0;">🎊 Chúc mừng bạn đã trúng tuyển!</h2>
        </div>
        <div style="padding: 25px 30px; background: #f8f9fa; border: 1px solid #e9ecef;">
          <p>Chào <b>${name}</b>,</p>
          <p>Chúng tôi vô cùng vui mừng thông báo: Bạn đã <b style="color: #28a745; font-size: 16px;">TRÚNG TUYỂN</b>${jobTitle ? ' vào vị trí <b>' + jobTitle + '</b>' : ''} tại công ty CIC!</p>
          <p>Chúng tôi đánh giá rất cao năng lực và sự phù hợp của bạn. Vui lòng phản hồi email này để chúng tôi gửi thư mời nhận việc chính thức và hướng dẫn các bước tiếp theo.</p>
          <p style="color: #666; font-size: 13px; margin-top: 30px;">Chào đón bạn gia nhập đội ngũ CIC! 🙌<br><b>Phòng Nhân Sự - CIC</b></p>
        </div>
      </div>`
  }),
  rejected: (name, jobTitle) => ({
    subject: `[CIC] Kết quả ứng tuyển${jobTitle ? ' - ' + jobTitle : ''}`,
    html: `
      <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: #2d3436; color: white; padding: 20px 30px; border-radius: 8px 8px 0 0;">
          <h2 style="margin: 0;">Thông báo kết quả</h2>
        </div>
        <div style="padding: 25px 30px; background: #f8f9fa; border: 1px solid #e9ecef;">
          <p>Chào <b>${name}</b>,</p>
          <p>Cảm ơn bạn đã dành thời gian tham gia quá trình tuyển dụng${jobTitle ? ' cho vị trí <b>' + jobTitle + '</b>' : ''} tại CIC.</p>
          <p>Sau khi cân nhắc kỹ lưỡng, chúng tôi rất tiếc phải thông báo rằng hồ sơ của bạn chưa phù hợp ở thời điểm hiện tại.</p>
          <p>Chúng tôi sẽ lưu trữ hồ sơ của bạn và liên hệ khi có vị trí phù hợp hơn trong tương lai. Chúc bạn mọi điều tốt đẹp!</p>
          <p style="color: #666; font-size: 13px; margin-top: 30px;">Trân trọng,<br><b>Phòng Nhân Sự - CIC</b></p>
        </div>
      </div>`
  }),
};

export function startRealtimeAutomator() {
  supabase
    .channel('recruitment-mailer')
    .on(
      'postgres_changes',
      { event: 'UPDATE', schema: 'public', table: 'applications' },
      async (payload: any) => {
        const oldStage = payload.old?.stage;
        const newStage = payload.new?.stage;

        if (!oldStage || !newStage || oldStage === newStage) return;

        console.log(`🔄 Pipeline: ${oldStage} → ${newStage} (Application ID: ${payload.new.id})`);

        // Lấy thông tin ứng viên
        const { data: cand } = await supabase
          .from('candidates')
          .select('full_name, email')
          .eq('id', payload.new.candidate_id)
          .single();

        if (!cand || !cand.email) {
          console.log("   ⚠️ Không tìm thấy email ứng viên, bỏ qua gửi mail.");
          return;
        }

        // Lấy tên vị trí tuyển dụng
        const { data: job } = await supabase
          .from('job_openings')
          .select('title')
          .eq('id', payload.new.job_opening_id)
          .single();

        const template = emailTemplates[newStage];
        if (!template) {
          console.log(`   ℹ️ Không có mẫu email cho stage "${newStage}", bỏ qua.`);
          return;
        }

        const { subject, html } = template(cand.full_name, job?.title);
        console.log(`   ✉️ Gửi email cho ${cand.email}...`);

        try {
          const info = await transporter.sendMail({
            from: `"Phòng Tuyển Dụng - CIC" <${config.smtp.auth.user}>`,
            to: cand.email,
            subject,
            html
          });
          console.log(`   ✅ Gửi thành công! Message ID: ${info.messageId}`);
        } catch (e: any) {
          console.error(`   ❌ Gửi mail thất bại: ${e.message}`);
        }
      }
    )
    .subscribe((status) => {
      console.log(`📡 Supabase Realtime status: ${status}`);
    });
}
