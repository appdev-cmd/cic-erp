// @ts-nocheck
import { ContractService } from '../../../contractService';
import { CustomerService } from '../../../customerService';
import { PaymentService } from '../../../paymentService';
import { UnitService } from '../../../unitService';
import { ProductService } from '../../../productService';
import type { OpenClawTool, UserContext } from '../types';
import { dataClient as supabase } from '../../../../lib/dataClient';
import { fmtMoney, fmtMoneyWithRaw, calcChange, canViewAll, isBusinessUnit, getUnitFilter } from './_helpers';
import { EmployeeService } from '../../../employeeService';
import { TaskService } from '../../../taskService';
import { NotificationService } from '../../../notificationService';
import { marketingToolsRegistry } from './marketingTools';
import type { OpenClawTool, UserContext } from '../types';
import { dataClient as supabase } from '../../../../lib/dataClient';
import { fmtMoney, fmtMoneyWithRaw, calcChange, canViewAll, isBusinessUnit, getUnitFilter } from './_helpers';

// ═══════════════════════════════════════════════
// searchKnowledgeBaseTool
// ═══════════════════════════════════════════════

export const searchKnowledgeBaseTool: OpenClawTool = {
  name: 'search_knowledge_base',
  description: 'Tra cứu kiến thức nội bộ, tài liệu công ty, quy trình, hướng dẫn từ cơ sở tri thức (Knowledge Base). Dùng khi user hỏi về quy trình, chính sách, tài liệu nội bộ.',
  schema: {
    query: { type: 'string', description: 'Câu hỏi hoặc từ khóa tìm kiếm' },
  },
  execute: async (args) => {
    try {
      // Import RAG service dynamically
      const { searchKnowledgeBase } = await import('../../../ragService');
      const results = await searchKnowledgeBase(args.query, 5);
      if (!results || results.trim().length === 0) {
        return { message: 'Không tìm thấy tài liệu nào liên quan trong Cơ sở Tri thức.' };
      }
      return { ketQua: results };
    } catch (err: any) {
      return { message: 'Hệ thống RAG chưa sẵn sàng. Lỗi: ' + err.message };
    }
  }
};

// ═══════════════════════════════════════════════
// searchDocumentRegistryTool
// ═══════════════════════════════════════════════

export const searchDocumentRegistryTool: OpenClawTool = {
  name: 'search_document_registry',
  description: 'Tìm kiếm tài liệu trong Document Registry (metadata tập trung). Tìm theo tên/mô tả, lọc theo danh mục (contract/report/hr/invoice...) hoặc liên kết entity. Dùng khi user hỏi "tìm tài liệu X", "có file nào về Y không", "tài liệu hợp đồng ABC".',
  schema: {
    query: { type: 'string', description: 'Từ khóa tìm kiếm (tên/mô tả tài liệu)' },
    category: { type: 'string', enum: ['contract', 'report', 'invoice', 'hr', 'legal', 'technical', 'general'], description: 'Lọc theo danh mục (tùy chọn)' },
    entityType: { type: 'string', enum: ['contract', 'employee', 'customer', 'unit'], description: 'Lọc theo loại entity liên kết (tùy chọn)' },
    useAI: { type: 'string', enum: ['true', 'false'], description: 'Dùng AI vector search thay vì text search (mặc định: false)' },
  },
  execute: async (args) => {
    try {
      // Nếu dùng AI vector search
      if (args.useAI === 'true' && args.query) {
        const { searchKnowledgeBase } = await import('../../../ragService');
        const results = await searchKnowledgeBase(args.query, {
          limit: 5,
          category: args.category,
          entityType: args.entityType,
        });
        if (results && results.trim().length > 0) {
          return { loaiTimKiem: 'AI Vector Search', ketQua: results };
        }
        return { message: 'Không tìm thấy tài liệu nào qua AI search.' };
      }

      // Text search trong document_registry
      const { DocumentRegistryService } = await import('../../../documentRegistryService');
      const { data } = await DocumentRegistryService.getAll({
        searchTerm: args.query || undefined,
        docCategory: args.category as any || undefined,
        entityType: args.entityType || undefined,
      });

      if (!data || data.length === 0) {
        return { message: 'Không tìm thấy tài liệu nào phù hợp.' };
      }

      return {
        tongKetQua: data.length,
        taiLieu: data.slice(0, 10).map((d: any) => ({
          tieuDe: d.title,
          danhMuc: d.docCategory,
          loaiFile: d.mimeType || d.sourceType,
          dungLuong: d.fileSize ? `${(d.fileSize / 1024).toFixed(0)} KB` : '—',
          aiDaDoc: d.isAiIndexed ? 'Đã đọc' : 'Chưa đọc',
          url: d.sourceUrl || '—',
          lienKet: d.entityType ? `${d.entityType}: ${d.entityId}` : '—',
        })),
      };
    } catch (err: any) {
      return { error: 'Lỗi tìm kiếm: ' + err.message };
    }
  }
};

