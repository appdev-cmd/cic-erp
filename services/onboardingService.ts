// ============================================================
// Onboarding Service — CIC ERP
// Theo dõi tiến độ hội nhập (Onboarding), khởi tạo checklist từ Candidate Hired
// ============================================================

import { dataClient as supabase } from '../lib/dataClient';
import type {
    OnboardingTemplate,
    OnboardingTask,
    OnboardingChecklist,
    OnboardingChecklistItem,
    OnboardingStatus,
    QuizQuestion
} from '../types/onboardingTypes';
import { chat } from './ai/gateway';

const SYSTEM_PROMPT = `Bạn là hệ thống thiết kế tài liệu đào tạo nội bộ và câu hỏi trắc nghiệm của công ty.
NHIỆM VỤ:
Đọc nội dung văn bản thô được cung cấp, chuyển đổi thành mã HTML sạch sẽ, định dạng đẹp mắt để hiển thị học tập, đồng thời tạo bộ câu hỏi trắc nghiệm gồm 5 câu hỏi để kiểm tra nhân sự mới.

ĐỊNH DẠNG TRẢ VỀ (BẮT BUỘC dạng JSON thuần, không kèm markdown \`\`\`json):
{
  "html": "<nội dung HTML sạch sẽ, sử dụng các thẻ h1, h2, h3, p, ul, li, strong, table, tr, td để trình bày trực quan>",
  "quiz": [
    {
      "question": "Câu hỏi số 1...",
      "options": ["Đáp án A", "Đáp án B", "Đáp án C", "Đáp án D"],
      "answerIndex": 0
    },
    ...
  ]
}

QUY TẮC:
- html: Chỉ dùng các thẻ HTML cơ bản (h1, h2, h3, p, ul, li, strong, table, tr, td). Không dùng CSS inline, không dùng class. Trình bày các phần rõ ràng, dễ đọc.
- quiz: Phải tạo đúng 5 câu hỏi trắc nghiệm trực tiếp liên quan đến tài liệu. Mỗi câu hỏi có đúng 4 phương án lựa chọn. answerIndex là index của đáp án đúng (0 cho phương án đầu tiên, 1 cho phương án thứ hai, v.v.).
- Trả về CHỈ JSON thuần, không kèm bất kỳ giải thích hay ký tự nào khác bên ngoài.`;

export const OnboardingService = {

    // ══════════════════════════════════════════
    // Templates & Tasks CRUD
    // ══════════════════════════════════════════

    async getTemplates(): Promise<OnboardingTemplate[]> {
        const { data, error } = await supabase
            .from('onboarding_templates')
            .select('*')
            .order('name');
        if (error) throw error;
        return (data || []) as OnboardingTemplate[];
    },

    async createTemplate(template: Partial<OnboardingTemplate>): Promise<OnboardingTemplate> {
        if (template.is_default) {
            // Set all other templates to false first
            await supabase
                .from('onboarding_templates')
                .update({ is_default: false })
                .eq('is_default', true);
        }
        
        const { data, error } = await supabase
            .from('onboarding_templates')
            .insert(template)
            .select()
            .single();
        if (error) throw error;
        return data as OnboardingTemplate;
    },

    async updateTemplate(id: string, updates: Partial<OnboardingTemplate>): Promise<OnboardingTemplate> {
        if (updates.is_default) {
            await supabase
                .from('onboarding_templates')
                .update({ is_default: false })
                .eq('is_default', true);
        }

        const { data, error } = await supabase
            .from('onboarding_templates')
            .update(updates)
            .eq('id', id)
            .select()
            .single();
        if (error) throw error;
        return data as OnboardingTemplate;
    },

    async deleteTemplate(id: string): Promise<void> {
        const { error } = await supabase
            .from('onboarding_templates')
            .delete()
            .eq('id', id);
        if (error) throw error;
    },

    async getTemplateTasks(templateId: string): Promise<OnboardingTask[]> {
        const { data, error } = await supabase
            .from('onboarding_tasks')
            .select('*')
            .eq('template_id', templateId)
            .order('sort_order', { ascending: true });
        if (error) throw error;
        return (data || []) as OnboardingTask[];
    },

    async createTemplateTask(task: Partial<OnboardingTask>): Promise<OnboardingTask> {
        const { data, error } = await supabase
            .from('onboarding_tasks')
            .insert(task)
            .select()
            .single();
        if (error) throw error;
        return data as OnboardingTask;
    },

    async updateTemplateTask(id: string, updates: Partial<OnboardingTask>): Promise<OnboardingTask> {
        const { data, error } = await supabase
            .from('onboarding_tasks')
            .update(updates)
            .eq('id', id)
            .select()
            .single();
        if (error) throw error;
        return data as OnboardingTask;
    },

    async deleteTemplateTask(id: string): Promise<void> {
        const { error } = await supabase
            .from('onboarding_tasks')
            .delete()
            .eq('id', id);
        if (error) throw error;
    },

    // ══════════════════════════════════════════
    // Checklists & Items
    // ══════════════════════════════════════════

    async getChecklists(): Promise<OnboardingChecklist[]> {
        const { data, error } = await supabase
            .from('onboarding_checklists')
            .select(`
                *,
                employee:employees!employee_id(name, employee_code),
                template:onboarding_templates!template_id(name)
            `)
            .order('start_date', { ascending: false });

        if (error) throw error;

        // Fetch items separately or via left join if supported. We'll aggregate manually here for stats
        const { data: itemData, error: itemError } = await supabase
            .from('onboarding_checklist_items')
            .select('checklist_id, status');
        if (itemError) throw itemError;

        return (data || []).map((row: any) => {
            const myItems = itemData?.filter((i: any) => i.checklist_id === row.id) || [];
            const total = myItems.length;
            const completed = myItems.filter((i: any) => i.status === 'completed').length;
            const progress = total > 0 ? Math.round((completed / total) * 100) : 0;

            return {
                ...row,
                employee_name: row.employee?.name,
                employee_code: row.employee?.employee_code,
                template_name: row.template?.name,
                progress
            };
        }) as OnboardingChecklist[];
    },

    async getChecklistItems(checklistId: string): Promise<OnboardingChecklistItem[]> {
        const { data, error } = await supabase
            .from('onboarding_checklist_items')
            .select(`
                *,
                task:onboarding_tasks!task_id(category, due_days),
                assignee:employees!assignee_id(name)
            `)
            .eq('checklist_id', checklistId)
            .order('created_at', { ascending: true });

        if (error) throw error;

        return (data || []).map((row: any) => ({
            ...row,
            assignee_name: row.assignee?.name,
            category: row.task?.category,
            due_days: row.task?.due_days,
        })) as OnboardingChecklistItem[];
    },

    async updateItemStatus(itemId: string, status: string): Promise<void> {
        const payload: any = { status };
        if (status === 'completed') {
            payload.completed_at = new Date().toISOString();
        } else {
            payload.completed_at = null;
        }

        const { error } = await supabase
            .from('onboarding_checklist_items')
            .update(payload)
            .eq('id', itemId);

        if (error) throw error;
    },

    async createChecklistItem(item: Partial<OnboardingChecklistItem>): Promise<OnboardingChecklistItem> {
        const { data, error } = await supabase
            .from('onboarding_checklist_items')
            .insert(item)
            .select()
            .single();
        if (error) throw error;
        return data as OnboardingChecklistItem;
    },

    async updateChecklistItem(id: string, updates: Partial<OnboardingChecklistItem>): Promise<OnboardingChecklistItem> {
        const { data, error } = await supabase
            .from('onboarding_checklist_items')
            .update(updates)
            .eq('id', id)
            .select()
            .single();
        if (error) throw error;
        return data as OnboardingChecklistItem;
    },

    async deleteChecklistItem(id: string): Promise<void> {
        const { error } = await supabase
            .from('onboarding_checklist_items')
            .delete()
            .eq('id', id);
        if (error) throw error;
    },

    async updateChecklistStatus(checklistId: string, status: OnboardingStatus): Promise<void> {
        const payload: any = { status };
        if (status === 'completed') {
            payload.completed_at = new Date().toISOString();
        } else {
            payload.completed_at = null;
        }

        const { error } = await supabase
            .from('onboarding_checklists')
            .update(payload)
            .eq('id', checklistId);
        if (error) throw error;
    },

    // ══════════════════════════════════════════
    // Core Workflow Auto-trigger
    // ══════════════════════════════════════════

    /**
     * Tạo một tiến trình thử việc cho nhân viên mới từ mẫu template
     * Được trigger khi một candidate ký HĐ trở thành NV hệ thống, hoặc gán thủ công từ giao diện
     */
    async launchOnboarding(employeeId: string, templateId: string | null, startDate: string, applicationId?: string): Promise<string> {
        // 1. Tạo checklist tổng
        const { data: checklist, error: listError } = await supabase
            .from('onboarding_checklists')
            .insert({
                employee_id: employeeId,
                template_id: templateId,
                application_id: applicationId || null,
                start_date: startDate,
                status: 'in_progress'
            })
            .select()
            .single();

        if (listError) throw listError;

        // 2. Clone tasks từ template sang thành items của checklist nếu có templateId
        if (templateId) {
            const { data: tasks, error: taskError } = await supabase
                .from('onboarding_tasks')
                .select('*')
                .eq('template_id', templateId)
                .order('sort_order', { ascending: true });

            if (taskError) throw taskError;

            if (tasks && tasks.length > 0) {
                const itemsToInsert = tasks.map((t: any) => ({
                    checklist_id: checklist.id,
                    task_id: t.id,
                    title: t.title,
                    // Assignee logic: In MVP, we assign to candidate directly if role is new_hire
                    assignee_id: t.assignee_role === 'new_hire' ? employeeId : null,
                    status: 'pending',
                    document_url: t.document_url,
                    document_name: t.document_name,
                    converted_html: t.converted_html,
                    quiz_questions: t.quiz_questions
                }));

                const { error: itemInsertError } = await supabase
                    .from('onboarding_checklist_items')
                    .insert(itemsToInsert);

                if (itemInsertError) throw itemInsertError;
            }
        }

        return checklist.id;
    },

    // ══════════════════════════════════════════
    // Document Upload & AI Quiz Methods
    // ══════════════════════════════════════════

    async uploadOnboardingMaterial(file: File): Promise<{ url: string; name: string }> {
        const fileExt = file.name.split('.').pop() || '';
        const fileName = `material_${Math.random().toString(36).substring(2)}_${Date.now()}.${fileExt}`;
        const filePath = `onboarding_materials/${fileName}`;

        const { error: uploadError } = await supabase.storage
            .from('documents')
            .upload(filePath, file, { upsert: true });

        if (uploadError) throw uploadError;

        const { data } = supabase.storage.from('documents').getPublicUrl(filePath);
        return {
            url: data.publicUrl,
            name: file.name
        };
    },

    async generateDocumentAndQuiz(text: string): Promise<{ html: string; quiz: QuizQuestion[] }> {
        const userPrompt = `NỘI DUNG TÀI LIỆU:\n${text}\n\nHãy chuyển đổi tài liệu trên và tạo quiz trắc nghiệm.`;
        try {
            const response = await chat({
                messages: [{ role: 'user', content: userPrompt }],
                model: 'qwen3.5-35b',
                systemInstruction: SYSTEM_PROMPT,
                temperature: 0.2,
                maxTokens: 3000,
                meta: { source: 'api' }
            });

            const jsonMatch = response.match(/```(?:json)?\s*([\s\S]*?)```/) || response.match(/(\{[\s\S]*\})/);
            if (!jsonMatch) {
                throw new Error('AI local không trả về JSON hợp lệ.');
            }

            const parsed = JSON.parse(jsonMatch[1].trim());
            return {
                html: parsed.html || '',
                quiz: parsed.quiz || []
            };
        } catch (error: any) {
            console.error('[Onboarding AI] Generate error:', error);
            throw new Error(`AI Local Error: ${error.message || String(error)}`);
        }
    },

    async updateQuizResult(itemId: string, score: number, passed: boolean): Promise<void> {
        const payload: any = {
            quiz_score: score,
            quiz_passed: passed,
            updated_at: new Date().toISOString()
        };

        if (passed) {
            payload.status = 'completed';
            payload.completed_at = new Date().toISOString();
        }

        const { error } = await supabase
            .from('onboarding_checklist_items')
            .update(payload)
            .eq('id', itemId);

        if (error) throw error;
    }
};
