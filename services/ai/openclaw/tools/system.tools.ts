// @ts-nocheck
import type { OpenClawTool, UserContext } from '../types';
import { dataClient as supabase } from '../../../../lib/dataClient';
import { TaskService } from '../../../taskService';
import { NotificationService } from '../../../notificationService';

// ═══════════════════════════════════════════════
// createTaskAiTool
// ═══════════════════════════════════════════════

export const createTaskAiTool: OpenClawTool = {
  name: 'create_task_ai',
  description: 'Tạo công việc (Task) lên hệ thống Kanban và giao việc cho nhân sự.',
  schema: {
    title: { type: 'string', description: 'Tiêu đề công việc' },
    description: { type: 'string', description: 'Mô tả chi tiết công việc' },
    assigneeIds: { type: 'array', items: { type: 'string' }, description: 'Danh sách ID nhân viên. BẮT BUỘC LẤY ID TỪ MỤC [CONTEXT] NẾU CÓ. CHỈ GỌI TOOL search_employees KHI TRONG CONTEXT KHÔNG CÓ ID.' },
    priority: { type: 'string', enum: ['high', 'medium', 'low'], description: 'Độ ưu tiên' },
    dueDate: { type: 'string', description: 'Hạn chót (YYYY-MM-DD)' },
    relatedEntityId: { type: 'string', description: 'ID của đối tượng liên quan (Hợp đồng, Khách hàng, Dự án...) lấy từ Context nếu có.' },
    relatedEntityType: { type: 'string', enum: ['contracts', 'customers', 'projects', 'units'], description: 'Loại của đối tượng liên quan.' }
  },
  execute: async (args, context: UserContext) => {
    try {
      if (!args.assigneeIds || args.assigneeIds.length === 0) return { error: 'Thiếu assigneeIds' };
      const task = await TaskService.create({
        title: args.title,
        description: args.description || '',
        assignees: args.assigneeIds,
        priority: args.priority || 'medium',
        due_date: args.dueDate || undefined,
        created_by: context.userId as any,
        auto_generated: true,
        source_entity_id: args.relatedEntityId,
        source_module: args.relatedEntityType || (args.relatedEntityId ? 'contracts' : undefined)
      });
      const taskLink = `/tasks?taskId=${task.id}`;
      return {
        success: true,
        taskId: task.id,
        message: `Đã tạo task thành công.\n\n👉 [Xem chi tiết công việc: ${args.title}](${taskLink})`
      };
    } catch (err: any) {
      return { error: err.message };
    }
  }
};

// ═══════════════════════════════════════════════
// approveTaskTool
// ═══════════════════════════════════════════════

export const approveTaskTool: OpenClawTool = {
  name: 'approve_task',
  description: 'Phê duyệt hoặc từ chối một task đang chờ phê duyệt. Dùng khi user nói "duyệt", "approve", "chấp nhận task".',
  schema: {
    taskId: { type: 'string', description: 'ID của task cần phê duyệt' },
    action: { type: 'string', enum: ['approve', 'reject'], description: 'approve = phê duyệt, reject = từ chối' },
    comment: { type: 'string', description: 'Ghi chú khi phê duyệt/từ chối (tùy chọn)' },
  },
  execute: async (args, context: UserContext) => {
    try {
      const task = await TaskService.getById(args.taskId);
      if (!task) return { error: 'Không tìm thấy task.' };

      if (args.action === 'approve') {
        // Mark as approved: move to completed status
        const statuses = await TaskService.getStatuses();
        const doneStatus = statuses.find(s => s.is_done && s.name?.includes('Hoàn thành'));
        if (doneStatus) {
          await TaskService.update(args.taskId, {
            status_id: doneStatus.id,
            approval_status: 'approved',
            approval_comment: args.comment || 'Đã phê duyệt qua AI Agent',
            completed_at: new Date().toISOString(),
            completed_by: context.userId,
          } as any);
        }
        const link = `/tasks?taskId=${args.taskId}`;
        return { success: true, message: `✅ Đã phê duyệt task "${task.title}".\n\n👉 [Xem chi tiết](${link})` };
      } else {
        await TaskService.update(args.taskId, {
          approval_status: 'rejected',
          approval_comment: args.comment || 'Từ chối qua AI Agent',
        } as any);
        return { success: true, message: `❌ Đã từ chối task "${task.title}". Lý do: ${args.comment || 'Không có'}` };
      }
    } catch (err: any) {
      return { error: err.message };
    }
  }
};

// ═══════════════════════════════════════════════
// exportDocumentTool
// ═══════════════════════════════════════════════

export const exportDocumentTool: OpenClawTool = {
  name: 'export_document',
  description: '[\u26A0\uFE0F QUAN TRỌNG: TUYỆT ĐỐI KHÔNG DÙNG TOOL NÀY NẾU USER CHỈ NÓI "LẬP BÁO CÁO" HAY "THỐNG KÊ". CHỈ ĐƯỢC CHẠY KHI USER NÓI RÕ "XUẤT FILE", "TẢI FILE", HOẶC "TẢI XUỐNG"] Tạo và tải file báo cáo. \\nLƯU Ý: \\n1. Báo cáo hãy viết dài, phân tích sâu.\\n2. Hãy tận dụng markdown \` \`\`\`chart \` để nhúng biểu đồ.\\n3. Chọn format=html nếu có biểu đồ.',
  schema: {
    title: { type: 'string', description: 'Tên báo cáo' },
    content: { type: 'string', description: 'Nội dung văn bản Markdown cực kỳ chi tiết có kèm biểu đồ ` ```chart ` nếu phù hợp' },
    format: { type: 'string', enum: ['doc', 'html'], description: 'Định dạng file xuất ra.' }
  },
  execute: async (args) => {
    try {
      const { marked } = await import('marked');
      const isHtml = args.format === 'html';

      // 1. Phân tích Chart Json
      let chartIds = 0;
      const safeContentForExport = args.content.replace(/```chart\s*([\s\S]*?)```/gim, (match, jsonString) => {
        if (!isHtml) {
          return '\n\n*[Biểu đồ động bị ẩn khi xuất file Word. Vui lòng xem trên nền tảng CIC ERP để tương tác với biểu đồ]*\n\n';
        }

        try {
          let cleanJson = jsonString.trim();
          if (cleanJson.startsWith('```json')) cleanJson = cleanJson.replace(/```json/gi, '').replace(/```/g, '').trim();
          const firstBrace = cleanJson.indexOf('{');
          const lastBrace = cleanJson.lastIndexOf('}');
          if (firstBrace !== -1 && lastBrace !== -1) {
            cleanJson = cleanJson.substring(firstBrace, lastBrace + 1);
          }
          const config = JSON.parse(cleanJson);
          chartIds++;
          const id = 'aiChart_' + chartIds;

          let datasets = [];
          if (config.lines && Array.isArray(config.lines)) {
            datasets = config.lines.map((line: any) => ({
              label: line.name || line.dataKey,
              data: config.data.map((d: any) => d[line.dataKey]),
              backgroundColor: line.color || '#3b82f6',
              borderColor: line.color || '#3b82f6',
              borderWidth: 2,
              borderRadius: config.type === 'bar' ? 4 : 0
            }));
          }

          const chartJsConfig = {
            type: config.type === 'bar' ? 'bar' : 'line',
            data: {
              labels: config.data.map((d: any) => d[config.xAxisKey || 'month' || 'name']),
              datasets: datasets
            },
            options: {
              responsive: true,
              maintainAspectRatio: false,
              plugins: {
                legend: { position: 'bottom' },
                title: { display: !!config.title, text: config.title, font: { size: 16 } }
              }
            }
          };

          return `
            <div style="background: white; border-radius: 8px; border: 1px solid #e2e8f0; padding: 20px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); margin: 30px 0; height: 350px;">
                <canvas id="${id}"></canvas>
            </div>
            <script>
                document.addEventListener('DOMContentLoaded', function() {
                    new Chart(
                        document.getElementById('${id}'),
                        ${JSON.stringify(chartJsConfig)}
                    );
                });
            </script>
            `;
        } catch (e) {
          return '<div style="color:red; border:1px dashed red; padding:10px;">Lỗi format biểu đồ JSON</div>';
        }
      });

      // 2. Chuyển Markdown sang HTML
      const htmlContent = await marked.parse(safeContentForExport);

      let finalContent = '';
      let fileName = '';
      let contentType = '';

      if (isHtml) {
        fileName = `ai_reports/${args.title.replace(/[^a-zA-Z0-9_-]/g, '_')}_${Date.now()}.html`;
        contentType = 'text/html';
        finalContent = `
<!DOCTYPE html>
<html lang="vi">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${args.title}</title>
<script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
<style>
  body { font-family: 'Inter', sans-serif; font-size: 15px; line-height: 1.6; color: #1e293b; background: #f1f5f9; margin: 0; padding: 40px 20px; }
  .container { max-width: 900px; margin: 0 auto; background: #fff; padding: 50px; border-radius: 12px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1); }
  table { border-collapse: collapse; width: 100%; margin: 20px 0; font-size: 14px; }
  table, th, td { border: 1px solid #e2e8f0; }
  th, td { padding: 12px 16px; text-align: left; }
  th { background-color: #f8fafc; font-weight: 600; color: #0f172a; white-space: nowrap; }
  h1 { font-size: 28px; text-align: center; color: #0f172a; border-bottom: 2px solid #e2e8f0; padding-bottom: 15px; margin-bottom: 30px;}
  h2 { font-size: 20px; color: #0f172a; margin-top: 40px; }
  h3 { font-size: 16px; font-weight: 600; color: #334155; }
</style>
</head>
<body>
<div class="container">
${htmlContent}
</div>
</body>
</html>`;
      } else {
        fileName = `ai_reports/${args.title.replace(/[^a-zA-Z0-9_-]/g, '_')}_${Date.now()}.doc`;
        contentType = 'application/msword;charset=utf-8';
        finalContent = `
<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
<head>
<meta charset='utf-8'>
<title>${args.title}</title>
<style>
  body { font-family: 'Times New Roman', serif; font-size: 14pt; line-height: 1.5; }
  table { border-collapse: collapse; width: 100%; margin: 15px 0; }
  table, th, td { border: 1px solid black; }
  th, td { padding: 8px; text-align: left; }
  th { background-color: #f2f2f2; font-weight: bold; }
  h1 { font-size: 22pt; text-align: center; font-weight: bold; }
  h2 { font-size: 18pt; font-weight: bold; margin-top: 20px; }
  h3 { font-size: 16pt; font-weight: bold; }
</style>
</head>
<body>
${htmlContent}
</body>
</html>`;
      }

      // Add BOM and upload
      const blob = new Blob(['\uFEFF' + finalContent], { type: contentType });

      const { error } = await supabase.storage.from('documents').upload(fileName, blob, {
        cacheControl: '3600',
        upsert: false,
        contentType: contentType
      });

      if (error) throw error;

      const { data } = supabase.storage.from('documents').getPublicUrl(fileName);

      return `Tạo file thành công! Bạn BẮT BUỘC phải dùng CHÍNH XÁC link URL này để người dùng tải xuống (TUYỆT ĐỐI KHÔNG TỰ BỊA RA LINK KHÁC):\n\nURL: [Tải báo cáo](${data.publicUrl})`;
    } catch (err: any) {
      return `Lỗi tạo file: ${err.message}`;
    }
  }
};

// ═══════════════════════════════════════════════
// sendNotificationEmailTool
// ═══════════════════════════════════════════════

export const sendNotificationEmailTool: OpenClawTool = {
  name: 'send_notification_email',
  description: 'Gửi Thông báo Email rải thư hoặc thông báo giao việc đến hệ thống.',
  schema: {
    targetUserId: { type: 'string', description: 'ID User đích' },
    subject: { type: 'string', description: 'Tiêu đề Email/Thông báo' },
    body: { type: 'string', description: 'Nội dung' }
  },
  execute: async (args, context: UserContext) => {
    try {
      if (!args.targetUserId) return { error: "Thiếu ID người nhận" };
      await NotificationService.createBulk(
        [args.targetUserId],
        'mention' as any,
        args.subject,
        args.body,
        { source: 'ai_agent' }
      );
      return { success: true, message: 'Đã đưa vào hàng đợi gửi tin thành công.' };
    } catch (err: any) {
      return { error: err.message };
    }
  }
};

