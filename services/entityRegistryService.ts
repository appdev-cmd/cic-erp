// Entity Registry Service — CIC ERP
// Simple CRUD for entity_registry table: resolve icons, URLs, labels for cross-module linking

import { dataClient as supabase } from '../lib/dataClient';
import type { EntityRegistryItem } from '../types/taskTypes';

// Cache entity registry items in memory (rarely changes)
let cache: EntityRegistryItem[] | null = null;

export const EntityRegistryService = {
  async getAll(): Promise<EntityRegistryItem[]> {
    if (cache) return cache;

    const { data, error } = await supabase
      .from('entity_registry')
      .select('*')
      .eq('is_active', true)
      .order('label');

    if (error) throw error;
    cache = (data || []) as EntityRegistryItem[];
    return cache;
  },

  async getByType(entityType: string): Promise<EntityRegistryItem | null> {
    const all = await this.getAll();
    return all.find(item => item.entity_type === entityType) || null;
  },

  /**
   * Resolve a URL for an entity (e.g., '/contracts/:id' + id='abc' → '/contracts/abc')
   */
  async resolveUrl(entityType: string, entityId: string, extraParams?: Record<string, string>): Promise<string | null> {
    const registry = await this.getByType(entityType);
    if (!registry?.url_pattern) return null;

    let url = registry.url_pattern.replace(':id', entityId);
    if (extraParams) {
      for (const [key, value] of Object.entries(extraParams)) {
        url = url.replace(`:${key}`, value);
      }
    }
    return url;
  },

  /**
   * Map entity_type → icon name (lucide icon string)
   */
  async getIconMap(): Promise<Record<string, string>> {
    const all = await this.getAll();
    const map: Record<string, string> = {};
    for (const item of all) {
      if (item.icon) map[item.entity_type] = item.icon;
    }
    return map;
  },

  /**
   * Map entity_type → color
   */
  async getColorMap(): Promise<Record<string, string>> {
    const all = await this.getAll();
    const map: Record<string, string> = {};
    for (const item of all) {
      if (item.color) map[item.entity_type] = item.color;
    }
    return map;
  },

  // Clear cache (call after updating entity_registry)
  clearCache() {
    cache = null;
  },

  // Admin: create new entity type
  async create(item: Omit<EntityRegistryItem, 'created_at'>): Promise<EntityRegistryItem> {
    const { data, error } = await supabase
      .from('entity_registry')
      .insert(item)
      .select()
      .single();

    if (error) throw error;
    this.clearCache();
    return data as EntityRegistryItem;
  },

  // Admin: update entity type
  async update(entityType: string, updates: Partial<EntityRegistryItem>): Promise<EntityRegistryItem> {
    const { data, error } = await supabase
      .from('entity_registry')
      .update(updates)
      .eq('entity_type', entityType)
      .select()
      .single();

    if (error) throw error;
    this.clearCache();
    return data as EntityRegistryItem;
  },
};
