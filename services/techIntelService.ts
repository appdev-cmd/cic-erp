/**
 * TechIntelService — CRUD service for ConTech Intelligence Hub
 * 
 * Handles articles, sources, reports, bookmarks, and taxonomy
 * following the existing CIC ERP service pattern (dataClient + static methods).
 */

import { dataClient as supabase } from '../lib/dataClient';
import type {
  TechArticle, TechSource, TechReport, TechBookmark,
  TechArticleFilter, TechDashboardStats, TechTaxonomyItem,
  TrendDataPoint, ReportType,
} from '../types/techIntel';

// ─── DB Row → Frontend Model Mappers ──────────────────

function mapSource(row: any): TechSource {
  return {
    id: row.id,
    name: row.name,
    url: row.url,
    type: row.type,
    language: row.language || 'en',
    country: row.country || 'US',
    category: row.category || 'general',
    isActive: !!row.is_active,
    crawlFrequency: row.crawl_frequency || 'daily',
    lastCrawledAt: row.last_crawled_at,
    articleCount: row.article_count || 0,
    config: row.config || {},
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapArticle(row: any): TechArticle {
  return {
    id: row.id,
    title: row.title,
    titleVi: row.title_vi,
    url: row.url,
    sourceId: row.source_id,
    sourceName: row.tech_sources?.name,
    sourceCountry: row.tech_sources?.country,
    summary: row.summary,
    summaryVi: row.summary_vi,
    content: row.content,
    contentVi: row.content_vi,
    thumbnailUrl: row.thumbnail_url,
    publishedAt: row.published_at,
    crawledAt: row.crawled_at,
    language: row.language || 'en',
    technologies: row.technologies || [],
    technologyCategory: row.technology_category,
    projectPhases: row.project_phases || [],
    industries: row.industries || [],
    eventType: row.event_type,
    companies: row.companies || [],
    deploymentProject: row.deployment_project,
    valueProposition: row.value_proposition,
    impactLevel: row.impact_level || 'medium',
    impactReason: row.impact_reason,
    status: row.status || 'pending',
    isBookmarked: false, // populated separately
    viewCount: row.view_count || 0,
    tags: row.tags || [],
    aiAnalysis: row.ai_analysis || {},
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapReport(row: any): TechReport {
  return {
    id: row.id,
    title: row.title,
    type: row.type,
    periodStart: row.period_start,
    periodEnd: row.period_end,
    contentMarkdown: row.content_markdown,
    contentHtml: row.content_html,
    status: row.status || 'draft',
    generatedAt: row.generated_at,
    generatedBy: row.generated_by || 'ai',
    articleCount: row.article_count || 0,
    highlights: row.highlights || [],
    statistics: row.statistics || {},
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapTaxonomy(row: any): TechTaxonomyItem {
  return {
    id: row.id,
    code: row.code,
    labelVi: row.label_vi,
    labelEn: row.label_en,
    group: row.group,
    parentId: row.parent_id,
    isActive: !!row.is_active,
    sortOrder: row.sort_order || 0,
    keywords: row.keywords || [],
    createdAt: row.created_at,
  };
}

// Article select query with source join
const ARTICLE_SELECT = `
  *,
  tech_sources(id, name, country, language)
`;

// ─── Service ──────────────────────────────────────────

export const TechIntelService = {

  // ═══════════════════════════════════════════
  // ARTICLES
  // ═══════════════════════════════════════════

  async getArticles(filter: TechArticleFilter = {}): Promise<{ articles: TechArticle[]; total: number }> {
    const pageSize = filter.pageSize || 20;
    const page = filter.page || 1;
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    let query = supabase
      .from('tech_articles')
      .select(ARTICLE_SELECT, { count: 'exact' });

    // Apply filters
    if (filter.search) {
      query = query.or(`title.ilike.%${filter.search}%,title_vi.ilike.%${filter.search}%,summary.ilike.%${filter.search}%,summary_vi.ilike.%${filter.search}%`);
    }
    if (filter.technologyCategory) {
      query = query.eq('technology_category', filter.technologyCategory);
    }
    if (filter.projectPhases && filter.projectPhases.length > 0) {
      query = query.overlaps('project_phases', filter.projectPhases);
    }
    if (filter.industries && filter.industries.length > 0) {
      query = query.overlaps('industries', filter.industries);
    }
    if (filter.impactLevel) {
      query = query.eq('impact_level', filter.impactLevel);
    }
    if (filter.eventType) {
      query = query.eq('event_type', filter.eventType);
    }
    if (filter.status) {
      query = query.eq('status', filter.status);
    } else {
      query = query.neq('status', 'spam');
    }
    if (filter.language) {
      query = query.eq('language', filter.language);
    }
    if (filter.sourceId) {
      query = query.eq('source_id', filter.sourceId);
    }
    if (filter.dateFrom) {
      query = query.gte('published_at', filter.dateFrom);
    }
    if (filter.dateTo) {
      query = query.lte('published_at', filter.dateTo);
    }

    // Sort
    switch (filter.sortBy) {
      case 'impact':
        query = query.order('impact_level', { ascending: false }).order('crawled_at', { ascending: false });
        break;
      case 'views':
        query = query.order('view_count', { ascending: false });
        break;
      case 'newest':
      default:
        query = query.order('crawled_at', { ascending: false });
    }

    // Paginate
    query = query.range(from, to);

    const { data, error, count } = await query;
    if (error) throw new Error(`Lỗi tải tin tức: ${error.message}`);

    return {
      articles: (data || []).map(mapArticle),
      total: count || 0,
    };
  },

  async getArticleById(id: string): Promise<TechArticle | null> {
    const { data, error } = await supabase
      .from('tech_articles')
      .select(ARTICLE_SELECT)
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      throw new Error(`Lỗi tải chi tiết bài viết: ${error.message}`);
    }
    return data ? mapArticle(data) : null;
  },

  async getRecentArticles(days: number = 7, limit: number = 10): Promise<TechArticle[]> {
    const since = new Date();
    since.setDate(since.getDate() - days);

    const { data, error } = await supabase
      .from('tech_articles')
      .select(ARTICLE_SELECT)
      .gte('crawled_at', since.toISOString())
      .in('status', ['analyzed', 'published'])
      .order('crawled_at', { ascending: false })
      .limit(limit);

    if (error) throw new Error(`Lỗi tải tin gần đây: ${error.message}`);
    return (data || []).map(mapArticle);
  },

  async getBreakthroughArticles(limit: number = 5): Promise<TechArticle[]> {
    const { data, error } = await supabase
      .from('tech_articles')
      .select(ARTICLE_SELECT)
      .in('impact_level', ['breakthrough', 'high'])
      .in('status', ['analyzed', 'published'])
      .order('crawled_at', { ascending: false })
      .limit(limit);

    if (error) throw new Error(`Lỗi tải tin đột phá: ${error.message}`);
    return (data || []).map(mapArticle);
  },

  async updateArticle(id: string, updates: Partial<Record<string, unknown>>): Promise<TechArticle> {
    const row: Record<string, unknown> = {};
    if (updates.titleVi !== undefined) row.title_vi = updates.titleVi;
    if (updates.summaryVi !== undefined) row.summary_vi = updates.summaryVi;
    if (updates.contentVi !== undefined) row.content_vi = updates.contentVi;
    if (updates.status !== undefined) row.status = updates.status;
    if (updates.impactLevel !== undefined) row.impact_level = updates.impactLevel;
    if (updates.impactReason !== undefined) row.impact_reason = updates.impactReason;
    if (updates.technologies !== undefined) row.technologies = updates.technologies;
    if (updates.technologyCategory !== undefined) row.technology_category = updates.technologyCategory;
    if (updates.projectPhases !== undefined) row.project_phases = updates.projectPhases;
    if (updates.industries !== undefined) row.industries = updates.industries;
    if (updates.eventType !== undefined) row.event_type = updates.eventType;
    if (updates.companies !== undefined) row.companies = updates.companies;
    if (updates.deploymentProject !== undefined) row.deployment_project = updates.deploymentProject;
    if (updates.valueProposition !== undefined) row.value_proposition = updates.valueProposition;
    if (updates.tags !== undefined) row.tags = updates.tags;
    if (updates.aiAnalysis !== undefined) row.ai_analysis = updates.aiAnalysis;
    row.updated_at = new Date().toISOString();

    const { data, error } = await supabase
      .from('tech_articles')
      .update(row)
      .eq('id', id)
      .select(ARTICLE_SELECT)
      .single();

    if (error) throw new Error(`Lỗi cập nhật bài viết: ${error.message}`);
    return mapArticle(data);
  },

  async incrementViewCount(id: string): Promise<void> {
    try {
      await supabase.rpc('increment_counter', {
        table_name: 'tech_articles',
        row_id: id,
        column_name: 'view_count',
      });
    } catch {
      // Fallback: direct update if RPC doesn't exist
      const { data: current } = await supabase
        .from('tech_articles')
        .select('view_count')
        .eq('id', id)
        .single();
      await supabase.from('tech_articles')
        .update({ view_count: (current?.view_count || 0) + 1 })
        .eq('id', id);
    }
  },

  async createArticle(article: {
    title: string;
    url: string;
    sourceId?: string;
    summary?: string;
    content?: string;
    thumbnailUrl?: string;
    publishedAt?: string;
    language?: string;
  }): Promise<TechArticle> {
    const { data, error } = await supabase
      .from('tech_articles')
      .insert([{
        title: article.title,
        url: article.url,
        source_id: article.sourceId,
        summary: article.summary,
        content: article.content,
        thumbnail_url: article.thumbnailUrl,
        published_at: article.publishedAt,
        language: article.language || 'en',
        status: 'pending',
      }])
      .select(ARTICLE_SELECT)
      .single();

    if (error) throw new Error(`Lỗi tạo bài viết: ${error.message}`);
    return mapArticle(data);
  },

  async deleteAllArticles(): Promise<void> {
    const { error } = await supabase
      .from('tech_articles')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000'); // Bypass filter restriction of Supabase client

    if (error) throw new Error(`Lỗi xóa toàn bộ bài viết: ${error.message}`);
  },


  /**
   * Get IDs of articles awaiting AI analysis (status = 'pending').
   * Used by auto-analyze after crawl.
   */
  async getPendingArticleIds(limit: number = 50): Promise<string[]> {
    const { data, error } = await supabase
      .from('tech_articles')
      .select('id')
      .eq('status', 'pending')
      .order('crawled_at', { ascending: true })
      .limit(limit);

    if (error) throw new Error(`Lỗi tải danh sách pending: ${error.message}`);
    return (data || []).map(r => r.id);
  },

  // ═══════════════════════════════════════════
  // SOURCES
  // ═══════════════════════════════════════════

  async getSources(): Promise<TechSource[]> {
    const { data, error } = await supabase
      .from('tech_sources')
      .select('*')
      .order('name');

    if (error) throw new Error(`Lỗi tải nguồn tin: ${error.message}`);
    return (data || []).map(mapSource);
  },

  async createSource(source: Omit<TechSource, 'id' | 'createdAt' | 'updatedAt' | 'lastCrawledAt' | 'articleCount'>): Promise<TechSource> {
    const { data, error } = await supabase
      .from('tech_sources')
      .insert([{
        name: source.name,
        url: source.url,
        type: source.type,
        language: source.language,
        country: source.country,
        category: source.category,
        is_active: source.isActive,
        crawl_frequency: source.crawlFrequency,
        config: source.config || {},
      }])
      .select()
      .single();

    if (error) throw new Error(`Lỗi tạo nguồn tin: ${error.message}`);
    return mapSource(data);
  },

  async updateSource(id: string, updates: Partial<TechSource>): Promise<TechSource> {
    const row: Record<string, unknown> = {};
    if (updates.name !== undefined) row.name = updates.name;
    if (updates.url !== undefined) row.url = updates.url;
    if (updates.type !== undefined) row.type = updates.type;
    if (updates.language !== undefined) row.language = updates.language;
    if (updates.country !== undefined) row.country = updates.country;
    if (updates.category !== undefined) row.category = updates.category;
    if (updates.isActive !== undefined) row.is_active = updates.isActive;
    if (updates.crawlFrequency !== undefined) row.crawl_frequency = updates.crawlFrequency;
    if (updates.config !== undefined) row.config = updates.config;
    row.updated_at = new Date().toISOString();

    const { data, error } = await supabase
      .from('tech_sources')
      .update(row)
      .eq('id', id)
      .select()
      .single();

    if (error) throw new Error(`Lỗi cập nhật nguồn tin: ${error.message}`);
    return mapSource(data);
  },

  async deleteSource(id: string): Promise<void> {
    const { error } = await supabase.from('tech_sources').delete().eq('id', id);
    if (error) throw new Error(`Lỗi xóa nguồn tin: ${error.message}`);
  },

  // ═══════════════════════════════════════════
  // REPORTS
  // ═══════════════════════════════════════════

  async getReports(type?: ReportType): Promise<TechReport[]> {
    let query = supabase
      .from('tech_reports')
      .select('*')
      .order('period_start', { ascending: false });

    if (type) query = query.eq('type', type);

    const { data, error } = await query;
    if (error) throw new Error(`Lỗi tải báo cáo: ${error.message}`);
    return (data || []).map(mapReport);
  },

  async getReportById(id: string): Promise<TechReport | null> {
    const { data, error } = await supabase
      .from('tech_reports')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      throw new Error(`Lỗi tải báo cáo: ${error.message}`);
    }
    return data ? mapReport(data) : null;
  },

  async createReport(report: {
    title: string;
    type: ReportType;
    periodStart: string;
    periodEnd: string;
    contentMarkdown?: string;
    contentHtml?: string;
    articleCount?: number;
    highlights?: string[];
    statistics?: Record<string, unknown>;
    generatedBy?: 'ai' | 'manual';
  }): Promise<TechReport> {
    const { data: userData } = await supabase.auth.getUser();

    const { data, error } = await supabase
      .from('tech_reports')
      .insert([{
        title: report.title,
        type: report.type,
        period_start: report.periodStart,
        period_end: report.periodEnd,
        content_markdown: report.contentMarkdown,
        content_html: report.contentHtml,
        article_count: report.articleCount || 0,
        highlights: report.highlights || [],
        statistics: report.statistics || {},
        generated_by: report.generatedBy || 'manual',
        created_by: userData?.user?.id,
      }])
      .select()
      .single();

    if (error) throw new Error(`Lỗi tạo báo cáo: ${error.message}`);
    return mapReport(data);
  },

  async publishReport(id: string): Promise<TechReport> {
    const { data, error } = await supabase
      .from('tech_reports')
      .update({ status: 'published', updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();

    if (error) throw new Error(`Lỗi xuất bản báo cáo: ${error.message}`);
    return mapReport(data);
  },

  // ═══════════════════════════════════════════
  // BOOKMARKS
  // ═══════════════════════════════════════════

  async getBookmarks(): Promise<TechBookmark[]> {
    const { data, error } = await supabase
      .from('tech_bookmarks')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw new Error(`Lỗi tải bookmarks: ${error.message}`);
    return (data || []).map(r => ({
      id: r.id,
      userId: r.user_id,
      articleId: r.article_id,
      note: r.note,
      createdAt: r.created_at,
    }));
  },

  async toggleBookmark(articleId: string): Promise<boolean> {
    const { data: userData } = await supabase.auth.getUser();
    const userId = userData?.user?.id;
    if (!userId) throw new Error('Chưa đăng nhập');

    // Check existing
    const { data: existing } = await supabase
      .from('tech_bookmarks')
      .select('id')
      .eq('user_id', userId)
      .eq('article_id', articleId)
      .single();

    if (existing) {
      await supabase.from('tech_bookmarks').delete().eq('id', existing.id);
      return false; // unbookmarked
    } else {
      await supabase.from('tech_bookmarks').insert([{ user_id: userId, article_id: articleId }]);
      return true; // bookmarked
    }
  },

  async getBookmarkedArticleIds(): Promise<Set<string>> {
    const { data } = await supabase
      .from('tech_bookmarks')
      .select('article_id');

    return new Set((data || []).map(r => r.article_id));
  },

  // ═══════════════════════════════════════════
  // TAXONOMY (Admin-expandable categories)
  // ═══════════════════════════════════════════

  async getTaxonomy(group?: string): Promise<TechTaxonomyItem[]> {
    let query = supabase
      .from('tech_taxonomy')
      .select('*')
      .order('sort_order');

    if (group) query = query.eq('group', group);

    const { data, error } = await query;
    if (error) throw new Error(`Lỗi tải phân loại: ${error.message}`);
    return (data || []).map(mapTaxonomy);
  },

  async createTaxonomy(item: Omit<TechTaxonomyItem, 'id' | 'createdAt'>): Promise<TechTaxonomyItem> {
    const { data, error } = await supabase
      .from('tech_taxonomy')
      .insert([{
        code: item.code,
        label_vi: item.labelVi,
        label_en: item.labelEn,
        group: item.group,
        parent_id: item.parentId,
        is_active: item.isActive,
        sort_order: item.sortOrder,
        keywords: item.keywords,
      }])
      .select()
      .single();

    if (error) throw new Error(`Lỗi tạo phân loại: ${error.message}`);
    return mapTaxonomy(data);
  },

  async updateTaxonomy(id: string, updates: Partial<TechTaxonomyItem>): Promise<TechTaxonomyItem> {
    const row: Record<string, unknown> = {};
    if (updates.code !== undefined) row.code = updates.code;
    if (updates.labelVi !== undefined) row.label_vi = updates.labelVi;
    if (updates.labelEn !== undefined) row.label_en = updates.labelEn;
    if (updates.isActive !== undefined) row.is_active = updates.isActive;
    if (updates.sortOrder !== undefined) row.sort_order = updates.sortOrder;
    if (updates.keywords !== undefined) row.keywords = updates.keywords;
    row.updated_at = new Date().toISOString();

    const { data, error } = await supabase
      .from('tech_taxonomy')
      .update(row)
      .eq('id', id)
      .select()
      .single();

    if (error) throw new Error(`Lỗi cập nhật phân loại: ${error.message}`);
    return mapTaxonomy(data);
  },

  // ═══════════════════════════════════════════
  // DASHBOARD STATISTICS
  // ═══════════════════════════════════════════

  async getDashboardStats(): Promise<TechDashboardStats> {
    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    // Parallel queries for performance
    const [
      { count: totalArticles },
      { count: weeklyArticles },
      { count: breakthroughCount },
      { count: activeSources },
      { count: totalReports },
      { data: recentBreakthroughsData },
      { data: allArticlesData },
    ] = await Promise.all([
      supabase.from('tech_articles').select('*', { count: 'exact', head: true }),
      supabase.from('tech_articles').select('*', { count: 'exact', head: true })
        .gte('crawled_at', weekAgo.toISOString()),
      supabase.from('tech_articles').select('*', { count: 'exact', head: true })
        .in('impact_level', ['breakthrough', 'high']),
      supabase.from('tech_sources').select('*', { count: 'exact', head: true })
        .eq('is_active', true),
      supabase.from('tech_reports').select('*', { count: 'exact', head: true }),
      supabase.from('tech_articles').select(ARTICLE_SELECT)
        .in('impact_level', ['breakthrough', 'high'])
        .in('status', ['analyzed', 'published'])
        .order('crawled_at', { ascending: false })
        .limit(5),
      supabase.from('tech_articles').select('technology_category, industries, crawled_at, impact_level')
        .in('status', ['analyzed', 'published'])
        .gte('crawled_at', new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString()),
    ]);

    // Compute distributions from fetched data
    const categoryMap: Record<string, number> = {};
    const industryMap: Record<string, number> = {};
    const weeklyMap: Record<string, { count: number; breakthroughCount: number }> = {};

    for (const a of (allArticlesData || [])) {
      if (a.technology_category) {
        categoryMap[a.technology_category] = (categoryMap[a.technology_category] || 0) + 1;
      }
      for (const ind of (a.industries || [])) {
        industryMap[ind] = (industryMap[ind] || 0) + 1;
      }
      const dateKey = a.crawled_at?.substring(0, 10);
      if (dateKey) {
        if (!weeklyMap[dateKey]) weeklyMap[dateKey] = { count: 0, breakthroughCount: 0 };
        weeklyMap[dateKey].count++;
        if (a.impact_level === 'breakthrough' || a.impact_level === 'high') {
          weeklyMap[dateKey].breakthroughCount++;
        }
      }
    }

    return {
      totalArticles: totalArticles || 0,
      weeklyArticles: weeklyArticles || 0,
      breakthroughCount: breakthroughCount || 0,
      activeSources: activeSources || 0,
      totalReports: totalReports || 0,
      categoryDistribution: Object.entries(categoryMap).map(([category, count]) => ({ category, count })),
      industryDistribution: Object.entries(industryMap).map(([industry, count]) => ({ industry, count })),
      weeklyTrend: Object.entries(weeklyMap)
        .map(([date, d]) => ({ date, count: d.count, breakthroughCount: d.breakthroughCount }))
        .sort((a, b) => a.date.localeCompare(b.date)),
      recentBreakthroughs: (recentBreakthroughsData || []).map(mapArticle),
    };
  },
};
