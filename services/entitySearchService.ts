import { dataClient } from '../lib/dataClient';
import { ContractService } from './contractService';

// Entity type → DB config with rich display
export const ENTITY_SEARCH_CONFIG: Record<string, {
  table: string;
  select: string;
  searchCol: string;
  format: (item: any) => { id: string; name: string; subText?: string };
}> = {
  task: {
    table: 'tasks',
    select: 'id, title, priority, due_date, status_id',
    searchCol: 'title',
    format: (item) => ({
      id: item.id,
      name: item.title,
      subText: [
        item.priority && item.priority !== 'none' ? `Ưu tiên: ${item.priority}` : null,
        item.due_date ? `Deadline: ${new Date(item.due_date).toLocaleDateString('vi-VN')}` : null,
      ].filter(Boolean).join(' · ') || undefined,
    }),
  },
  contract: {
    table: 'contracts',
    select: 'id, title, contract_code, party_a, value, status',
    searchCol: 'title',
    format: (item) => ({
      id: item.id,
      name: `${item.contract_code || ''} — ${item.title || ''}`.replace(/^\s*—\s*/, ''),
      subText: [
        item.party_a ? `KH: ${item.party_a}` : null,
        item.value ? `GT: ${Number(item.value).toLocaleString('vi-VN')} đ` : null,
        item.status || null,
      ].filter(Boolean).join(' · ') || undefined,
    }),
  },
  customer: {
    table: 'customers',
    select: 'id, name, short_name, address, phone',
    searchCol: 'name',
    format: (item) => ({
      id: item.id,
      name: item.name,
      subText: [
        item.short_name || null,
        item.address || null,
        item.phone || null,
      ].filter(Boolean).join(' · ') || undefined,
    }),
  },
  employee: {
    table: 'employees',
    select: 'id, name, position, department',
    searchCol: 'name',
    format: (item) => ({
      id: item.id,
      name: item.name,
      subText: [item.position, item.department].filter(Boolean).join(' — ') || undefined,
    }),
  },
  unit: {
    table: 'units',
    select: 'id, name, code',
    searchCol: 'name',
    format: (item) => ({
      id: item.id,
      name: item.name,
      subText: item.code || undefined,
    }),
  },
  pakd: {
    table: 'contract_business_plans',
    select: 'id, ten_cong_trinh, contract_id',
    searchCol: 'ten_cong_trinh',
    format: (item) => ({
      id: item.id,
      name: item.ten_cong_trinh || item.id,
    }),
  },
  receipt: {
    table: 'payments',
    select: 'id, description, amount, due_date, payment_type',
    searchCol: 'description',
    format: (item) => ({
      id: item.id,
      name: item.description || `Phiếu #${item.id.substring(0, 8)}`,
      subText: [
        item.payment_type || null,
        item.amount ? `${Number(item.amount).toLocaleString('vi-VN')} đ` : null,
        item.due_date ? `Hạn: ${new Date(item.due_date).toLocaleDateString('vi-VN')}` : null,
      ].filter(Boolean).join(' · ') || undefined,
    }),
  },
  product: {
    table: 'products',
    select: 'id, name, code, unit_price',
    searchCol: 'name',
    format: (item) => ({
      id: item.id,
      name: item.code ? `${item.code} — ${item.name}` : item.name,
      subText: item.unit_price ? `Đơn giá: ${Number(item.unit_price).toLocaleString('vi-VN')} đ` : undefined,
    }),
  },
};

export const EntitySearchService = {
  /**
   * Universal search across registered module entities
   */
  async search(entityType: string, query: string, profile?: any): Promise<{ id: string; name: string; subText?: string }[]> {
    if (!query || query.length < 2 || !entityType || entityType === 'none') return [];

    try {
      // 1. Specialized handling for contracts leveraging RLS and advanced filtering
      if (entityType === 'contract' && profile) {
        const contracts = await ContractService.searchAuthorized(query, profile, 20);
        return contracts.map(c => ({
          id: c.id,
          name: `${c.contractCode || ''} — ${c.title || ''}`.replace(/^\s*—\s*/, ''),
          subText: [
            c.partyA ? `KH: ${c.partyA}` : null,
            c.value ? `GT: ${Number(c.value).toLocaleString('vi-VN')} đ` : null,
            c.status || null,
          ].filter(Boolean).join(' · ') || undefined
        }));
      }

      const config = ENTITY_SEARCH_CONFIG[entityType];

      // 2. Fallback arbitrary table search if not explicitly configured
      if (!config) {
        const { data } = await dataClient.from(entityType).select('*').limit(20);
        if (!data) return [];
        return data.filter((item: any) => {
          const text = (item.name || item.title || item.contract_name || item.full_name || item.id || '').toLowerCase();
          return text.includes(query.toLowerCase());
        }).map((item: any) => ({
          id: item.id,
          name: item.name || item.title || item.contract_name || item.full_name || item.id,
        }));
      }

      // 3. Regular configured search
      let data: any[] | null = null;
      if (entityType === 'contract') { // Fallback if no profile
        const { data: d } = await dataClient
          .from(config.table)
          .select(config.select)
          .or(`title.ilike.%${query}%,contract_code.ilike.%${query}%,party_a.ilike.%${query}%`)
          .limit(20);
        data = d;
      } else if (entityType === 'customer') {
        const { data: d } = await dataClient
          .from(config.table)
          .select(config.select)
          .or(`name.ilike.%${query}%,short_name.ilike.%${query}%,tax_code.ilike.%${query}%`)
          .limit(20);
        data = d;
      } else {
        const { data: d } = await dataClient
          .from(config.table)
          .select(config.select)
          .ilike(config.searchCol, `%${query}%`)
          .limit(20);
        data = d;
      }

      if (!data) return [];
      return data.map(config.format);
    } catch (err) {
      console.error(`[EntitySearchService] Search error for ${entityType}:`, err);
      return [];
    }
  },

  /**
   * Fetch label for an entity (used when initializing dropdowns by IDs)
   */
  async getLabel(entityType: string, id: string): Promise<string> {
    if (!id || !entityType || entityType === 'none') return '';
    
    try {
      const config = ENTITY_SEARCH_CONFIG[entityType];
      if (!config) {
        const { data } = await dataClient.from(entityType).select('*').eq('id', id).single();
        return data ? (data.name || data.title || data.contract_name || data.full_name || data.id) : '';
      }
      
      const { data } = await dataClient.from(config.table).select(config.select).eq('id', id).single();
      if (data) {
        return config.format(data).name;
      }
      return 'Đã chọn';
    } catch (err) {
      console.warn(`[EntitySearchService] label resolution failed for ${entityType} ${id}:`, err);
      return '';
    }
  }
};
