/**
 * Recruitment Email Templates
 * 
 * Cung cấp email templates mặc định cho từng stage tuyển dụng.
 * HR có thể xem, chỉnh sửa nội dung trước khi gửi.
 */

export interface EmailTemplate {
  subject: string;
  bodyHtml: string;
  headerBg: string;
  headerText: string;
}

/**
 * Tạo wrapper HTML chung cho tất cả email tuyển dụng
 */
export function emailWrapper(headerBg: string, headerText: string, bodyHtml: string): string {
  return `
<div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 12px rgba(0,0,0,0.08);">
  <div style="background: ${headerBg}; color: white; padding: 24px 30px;">
    <h2 style="margin: 0; font-size: 18px;">${headerText}</h2>
  </div>
  <div style="padding: 28px 30px; background: #ffffff; border: 1px solid #e9ecef; border-top: none;">
    ${bodyHtml}
  </div>
</div>`.trim();
}

/**
 * Lấy email template mặc định theo stage
 */
export function getEmailTemplate(
  stage: string,
  candidateName: string,
  jobTitle?: string,
  extras?: { rejectionReason?: string; offerSalary?: number; onboardDate?: string }
): EmailTemplate | null {
  const jobSuffix = jobTitle ? ` - ${jobTitle}` : '';
  const jobMention = jobTitle ? ` vào vị trí <strong>${jobTitle}</strong>` : '';

  switch (stage) {
    case 'screening':
      return {
        subject: `[CIC] Xác nhận nhận hồ sơ ứng tuyển${jobSuffix}`,
        headerBg: '#1a1a2e',
        headerText: 'CIC - Phòng Tuyển Dụng',
        bodyHtml: `
          <p>Chào <strong>${candidateName}</strong>,</p>
          <p>Cảm ơn bạn đã quan tâm và nộp hồ sơ ứng tuyển${jobMention} tại Công ty CIC.</p>
          <p>Hồ sơ của bạn đã được tiếp nhận thành công và đang trong giai đoạn <strong>Sàng lọc CV</strong>. Chúng tôi sẽ liên hệ lại với bạn trong thời gian sớm nhất.</p>
        `
      };

    case 'interview_1':
      return {
        subject: `[CIC] Thư mời Phỏng vấn Vòng 1${jobSuffix}`,
        headerBg: '#0f3460',
        headerText: '🎉 Chúc mừng!',
        bodyHtml: `
          <p>Chào <strong>${candidateName}</strong>,</p>
          <p>Sau quá trình sàng lọc, chúng tôi rất vui thông báo bạn đã <strong style="color: #28a745;">vượt qua vòng hồ sơ</strong>${jobMention}.</p>
          <p>Chúng tôi sẽ sớm liên hệ để sắp xếp lịch phỏng vấn Vòng 1 phù hợp với bạn.</p>
          <p>Vui lòng kiểm tra email thường xuyên hoặc giữ điện thoại liên lạc nhé.</p>
        `
      };

    case 'interview_2':
      return {
        subject: `[CIC] Thư mời Phỏng vấn Vòng 2${jobSuffix}`,
        headerBg: '#533483',
        headerText: '🚀 Tiếp tục hành trình!',
        bodyHtml: `
          <p>Chào <strong>${candidateName}</strong>,</p>
          <p>Chúc mừng bạn đã hoàn thành xuất sắc Vòng Phỏng vấn 1! Chúng tôi mời bạn tiếp tục tham gia <strong>Phỏng vấn Vòng 2</strong>${jobMention}.</p>
          <p>Chi tiết lịch phỏng vấn sẽ được gửi riêng qua email hoặc điện thoại.</p>
        `
      };

    case 'technical_test':
      return {
        subject: `[CIC] Thư mời làm bài Test kỹ thuật${jobSuffix}`,
        headerBg: '#e94560',
        headerText: '📝 Bài kiểm tra kỹ thuật',
        bodyHtml: `
          <p>Chào <strong>${candidateName}</strong>,</p>
          <p>Bạn đã được mời tham gia <strong>bài kiểm tra kỹ thuật</strong>${jobMention}.</p>
          <p>Thông tin chi tiết về bài test (link, thời gian, yêu cầu) sẽ được gửi riêng trong email tiếp theo.</p>
        `
      };

    case 'offer':
      return {
        subject: `[CIC] 🎊 THƯ MỜI NHẬN VIỆC (Offer Letter)${jobSuffix}`,
        headerBg: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        headerText: '🎊 Chúc mừng bạn đã trúng tuyển!',
        bodyHtml: `
          <p>Chào <strong>${candidateName}</strong>,</p>
          <p>Chúng tôi vô cùng vui mừng thông báo: Bạn đã <strong style="color: #28a745;">TRÚNG TUYỂN</strong>${jobMention} tại Công ty CIC!</p>
          ${extras?.offerSalary ? `<p>Mức lương đề nghị: <strong>${new Intl.NumberFormat('vi-VN').format(extras.offerSalary)} VND</strong></p>` : ''}
          ${extras?.onboardDate ? `<p>Ngày nhận việc dự kiến: <strong>${extras.onboardDate}</strong></p>` : ''}
          <p>Chúng tôi đánh giá rất cao năng lực và sự phù hợp của bạn. Vui lòng phản hồi email này để chúng tôi gửi thư mời nhận việc chính thức và hướng dẫn các bước tiếp theo.</p>
          <p style="color: #666;">Chào đón bạn gia nhập đội ngũ CIC! 🙌</p>
        `
      };

    case 'hired':
      return {
        subject: `[CIC] 🎉 Chào mừng gia nhập CIC!${jobSuffix}`,
        headerBg: 'linear-gradient(135deg, #11998e 0%, #38ef7d 100%)',
        headerText: '🎉 Chào mừng thành viên mới!',
        bodyHtml: `
          <p>Chào <strong>${candidateName}</strong>,</p>
          <p>Chúng tôi xác nhận bạn đã chính thức trở thành thành viên của <strong>CIC</strong>${jobMention}!</p>
          ${extras?.onboardDate ? `<p>Ngày nhận việc: <strong>${extras.onboardDate}</strong></p>` : ''}
          <p>Phòng Nhân sự sẽ liên hệ với bạn để hướng dẫn thủ tục onboarding và chuẩn bị ngày đầu tiên.</p>
          <p>Chúng tôi rất mong chờ được làm việc cùng bạn! 🚀</p>
        `
      };

    case 'rejected':
      return {
        subject: `[CIC] Kết quả ứng tuyển${jobSuffix}`,
        headerBg: '#2d3436',
        headerText: 'Thông báo kết quả',
        bodyHtml: `
          <p>Chào <strong>${candidateName}</strong>,</p>
          <p>Cảm ơn bạn đã dành thời gian tham gia quá trình tuyển dụng${jobMention} tại CIC.</p>
          ${extras?.rejectionReason
            ? `<p>Lý do: <em>${extras.rejectionReason}</em></p>`
            : '<p>Sau khi cân nhắc kỹ lưỡng, chúng tôi rất tiếc phải thông báo rằng hồ sơ của bạn chưa phù hợp ở thời điểm hiện tại.</p>'
          }
          <p>Chúng tôi sẽ lưu trữ hồ sơ của bạn và liên hệ khi có vị trí phù hợp hơn trong tương lai. Chúc bạn mọi điều tốt đẹp!</p>
        `
      };

    case 'withdrawn':
      return {
        subject: `[CIC] Xác nhận rút hồ sơ ứng tuyển${jobSuffix}`,
        headerBg: '#636e72',
        headerText: 'Xác nhận rút hồ sơ',
        bodyHtml: `
          <p>Chào <strong>${candidateName}</strong>,</p>
          <p>Chúng tôi xác nhận đã nhận được yêu cầu rút hồ sơ ứng tuyển${jobMention} của bạn.</p>
          <p>Hồ sơ của bạn vẫn được lưu trữ trong hệ thống. Nếu bạn đổi ý hoặc quan tâm đến các vị trí khác trong tương lai, đừng ngần ngại liên hệ lại với chúng tôi.</p>
          <p>Chúc bạn mọi điều tốt đẹp!</p>
        `
      };

    default:
      return null;
  }
}

/**
 * Danh sách các stage có hỗ trợ gửi email
 */
export const EMAIL_SUPPORTED_STAGES = [
  'screening',
  'interview_1',
  'interview_2',
  'technical_test',
  'offer',
  'hired',
  'rejected',
  'withdrawn'
] as const;

/**
 * Kiểm tra stage có hỗ trợ gửi email không
 */
export function isEmailSupportedStage(stage: string): boolean {
  return EMAIL_SUPPORTED_STAGES.includes(stage as any);
}
