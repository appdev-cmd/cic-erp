// ============================================
// CONTECH INTELLIGENCE HUB — Type Definitions
// Smart Technology Monitoring & Analysis Center
// for Construction, Infrastructure & Engineering
// ============================================

// ─── Technology Categories (Nhóm A) ────────────────────
export type TechCategory =
  | 'software_platform'       // A1: Phần mềm & Nền tảng số
  | 'ai_solution'             // A2: Giải pháp AI
  | 'robotics_automation'     // A3: Robot & Tự động hóa
  | 'consulting'              // A4: Dịch vụ tư vấn
  | 'green_certification'     // A5: Chứng chỉ & Tiêu chuẩn xanh
  | 'energy_emission';        // A6: Tiết kiệm NL & Giảm phát thải

export const TECH_CATEGORY_LABELS: Record<TechCategory, string> = {
  software_platform: 'Phần mềm & Nền tảng số',
  ai_solution: 'Giải pháp AI',
  robotics_automation: 'Robot & Tự động hóa',
  consulting: 'Dịch vụ tư vấn',
  green_certification: 'Chứng chỉ & Tiêu chuẩn xanh',
  energy_emission: 'Tiết kiệm NL & Giảm phát thải',
};

export const TECH_CATEGORY_COLORS: Record<TechCategory, string> = {
  software_platform: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  ai_solution: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
  robotics_automation: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  consulting: 'bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400',
  green_certification: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  energy_emission: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
};

// ─── Project Lifecycle Phases (Nhóm B) ─────────────────
export type ProjectPhase =
  | 'survey'              // B1: Khảo sát & Thu thập
  | 'design'              // B2: Thiết kế
  | 'planning'            // B3: Lập kế hoạch
  | 'construction'        // B4: Thi công
  | 'project_management'  // B5: Quản lý dự án
  | 'handover'            // B6: Hoàn công & Bàn giao
  | 'operations'          // B7: Vận hành & Bảo trì
  | 'monitoring';         // B8: Giám sát vận hành

export const PROJECT_PHASE_LABELS: Record<ProjectPhase, string> = {
  survey: 'Khảo sát',
  design: 'Thiết kế',
  planning: 'Lập kế hoạch',
  construction: 'Thi công',
  project_management: 'Quản lý DA',
  handover: 'Bàn giao',
  operations: 'Vận hành',
  monitoring: 'Giám sát',
};

// ─── Industry Sectors (Nhóm C) ─────────────────────────
export type IndustrySector =
  | 'civil'           // C1: Xây dựng dân dụng
  | 'industrial'      // C2: Xây dựng công nghiệp
  | 'infrastructure'  // C3: Hạ tầng
  | 'energy'          // C4: Năng lượng
  | 'oil_gas'         // C5: Dầu khí
  | 'power'           // C6: Điện lực
  | 'mining'          // C7: Khai khoáng
  | 'materials'       // C8: Vật liệu xây dựng
  | 'manufacturing';  // C9: Sản xuất công nghiệp

export const INDUSTRY_SECTOR_LABELS: Record<IndustrySector, string> = {
  civil: 'Xây dựng dân dụng',
  industrial: 'Xây dựng công nghiệp',
  infrastructure: 'Hạ tầng',
  energy: 'Năng lượng',
  oil_gas: 'Dầu khí',
  power: 'Điện lực',
  mining: 'Khai khoáng',
  materials: 'Vật liệu XD',
  manufacturing: 'Sản xuất CN',
};

// ─── Event Types ───────────────────────────────────────
export type TechEventType =
  | 'product_launch'       // Ra mắt sản phẩm mới
  | 'new_solution'         // Ra mắt giải pháp mới
  | 'project_announcement' // Công bố dự án mới
  | 'new_customer'         // Công bố khách hàng mới
  | 'partnership'          // Đối tác mới
  | 'case_study'           // Case Study
  | 'conference'           // Hội nghị / Triển lãm
  | 'webinar'              // Webinar / Hội thảo
  | 'white_paper'          // White Paper / Research
  | 'review'               // Đánh giá / Review
  | 'pilot_project'        // Dự án thử nghiệm
  | 'large_deployment';    // Triển khai quy mô lớn

export const EVENT_TYPE_LABELS: Record<TechEventType, string> = {
  product_launch: 'Ra mắt sản phẩm',
  new_solution: 'Giải pháp mới',
  project_announcement: 'Dự án mới',
  new_customer: 'Khách hàng mới',
  partnership: 'Đối tác mới',
  case_study: 'Case Study',
  conference: 'Hội nghị / Triển lãm',
  webinar: 'Webinar',
  white_paper: 'White Paper',
  review: 'Đánh giá',
  pilot_project: 'Pilot Project',
  large_deployment: 'Triển khai lớn',
};

// ─── Impact Levels ─────────────────────────────────────
export type ImpactLevel = 'low' | 'medium' | 'high' | 'breakthrough';

export const IMPACT_LEVEL_LABELS: Record<ImpactLevel, string> = {
  low: 'Thấp',
  medium: 'Trung bình',
  high: 'Cao',
  breakthrough: 'Đột phá',
};

export const IMPACT_LEVEL_COLORS: Record<ImpactLevel, string> = {
  low: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400',
  medium: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  high: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  breakthrough: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
};

// ─── Article Status ────────────────────────────────────
export type ArticleStatus = 'pending' | 'analyzing' | 'analyzed' | 'published' | 'archived' | 'spam';

export const ARTICLE_STATUS_LABELS: Record<ArticleStatus, string> = {
  pending: 'Chờ phân tích',
  analyzing: 'Đang phân tích',
  analyzed: 'Đã phân tích',
  published: 'Đã xuất bản',
  archived: 'Lưu trữ',
  spam: 'Spam / Rác',
};

// ─── Source Types ──────────────────────────────────────
export type SourceType = 'rss' | 'google_news' | 'web' | 'deep_crawl' | 'api' | 'manual';

export const SOURCE_TYPE_LABELS: Record<SourceType, string> = {
  rss: 'RSS Feed',
  google_news: 'Google News RSS',
  web: 'Web Scraping',
  deep_crawl: 'Deep Crawl (Website)',
  api: 'API',
  manual: 'Nhập thủ công',
};

export type CrawlFrequency = 'hourly' | 'daily' | 'weekly';

// ─── Report Types ──────────────────────────────────────
export type ReportType = 'weekly' | 'monthly' | 'quarterly' | 'custom';

export const REPORT_TYPE_LABELS: Record<ReportType, string> = {
  weekly: 'Bản tin tuần',
  monthly: 'Báo cáo tháng',
  quarterly: 'Báo cáo quý',
  custom: 'Tùy chỉnh',
};

// ─── Languages & Countries ─────────────────────────────
export const SUPPORTED_LANGUAGES = [
  { code: 'en', label: 'English', flag: '🇺🇸' },
  { code: 'vi', label: 'Tiếng Việt', flag: '🇻🇳' },
  { code: 'zh', label: '中文', flag: '🇨🇳' },
  { code: 'ja', label: '日本語', flag: '🇯🇵' },
  { code: 'ko', label: '한국어', flag: '🇰🇷' },
  { code: 'de', label: 'Deutsch', flag: '🇩🇪' },
  { code: 'fr', label: 'Français', flag: '🇫🇷' },
  { code: 'he', label: 'עברית', flag: '🇮🇱' },
  { code: 'hi', label: 'हिन्दी', flag: '🇮🇳' },
] as const;

export const SUPPORTED_COUNTRIES = [
  'US', 'CA', 'GB', 'CN', 'KR', 'JP', 'DE', 'FR', 'NL', 'SE', 'NO', 'FI',
  'IL', 'IN', 'SG', 'AU', 'VN', 'AE', 'SA', 'IT', 'ES', 'CH', 'AT',
] as const;

// ─── Main Interfaces ──────────────────────────────────

/** Tech news source (RSS feed, Google News, etc.) */
export interface TechSource {
  id: string;
  name: string;
  url: string;
  type: SourceType;
  language: string;
  country: string;
  category: string;
  isActive: boolean;
  crawlFrequency: CrawlFrequency;
  lastCrawledAt?: string;
  articleCount?: number;
  config?: Record<string, unknown> | DeepCrawlConfig;
  createdAt: string;
  updatedAt: string;
}

/** Configuration for deep_crawl source type */
export interface DeepCrawlConfig {
  maxDepth: number;            // BFS depth 1-3, default 2
  maxPages: number;            // Max total pages to crawl, default 50
  includePatterns?: string[];  // URL regex patterns to follow
  excludePatterns?: string[];  // URL regex patterns to skip
  jsEnabled: boolean;          // Enable Playwright JS rendering
  stealthMode: boolean;        // Enable anti-bot stealth
  contentFilter: 'pruning' | 'bm25' | 'none';  // Content filter strategy
}

/** Tech news article — the core entity */
export interface TechArticle {
  id: string;
  title: string;
  titleVi?: string;
  url: string;
  sourceId?: string;
  sourceName?: string;
  sourceCountry?: string;
  summary?: string;
  summaryVi?: string;
  content?: string;
  contentVi?: string;
  thumbnailUrl?: string;
  publishedAt?: string;
  crawledAt: string;
  language: string;

  // AI classification fields
  technologies: string[];
  technologyCategory?: TechCategory;
  projectPhases: ProjectPhase[];
  industries: IndustrySector[];
  eventType?: TechEventType;
  companies: string[];
  deploymentProject?: string;
  valueProposition?: string;
  impactLevel: ImpactLevel;
  impactReason?: string;

  status: ArticleStatus;
  isBookmarked?: boolean;
  viewCount: number;
  tags: string[];
  aiAnalysis?: Record<string, unknown>;

  createdAt: string;
  updatedAt: string;
}

/** Report — weekly/monthly/quarterly digest */
export interface TechReport {
  id: string;
  title: string;
  type: ReportType;
  periodStart: string;
  periodEnd: string;
  contentMarkdown?: string;
  contentHtml?: string;
  status: 'draft' | 'published';
  generatedAt: string;
  generatedBy: 'ai' | 'manual';
  articleCount: number;
  highlights: string[];
  statistics?: ReportStatistics;
  createdBy?: string;
  createdAt: string;
  updatedAt: string;
}

/** User bookmark on an article */
export interface TechBookmark {
  id: string;
  userId: string;
  articleId: string;
  note?: string;
  createdAt: string;
}

// ─── Statistics & Analytics ───────────────────────────

export interface ReportStatistics {
  totalArticles: number;
  byCategory: Record<string, number>;
  byIndustry: Record<string, number>;
  byPhase: Record<string, number>;
  byImpact: Record<string, number>;
  byEventType: Record<string, number>;
  topCompanies: { name: string; count: number }[];
  topTechnologies: { name: string; count: number }[];
  trendData: TrendDataPoint[];
}

export interface TrendDataPoint {
  date: string;
  count: number;
  breakthroughCount: number;
}

export interface TechDashboardStats {
  totalArticles: number;
  weeklyArticles: number;
  breakthroughCount: number;
  activeSources: number;
  totalReports: number;
  lastCrawledAt?: string;
  categoryDistribution: { category: string; count: number }[];
  industryDistribution: { industry: string; count: number }[];
  weeklyTrend: TrendDataPoint[];
  recentBreakthroughs: TechArticle[];
}

// ─── Filter & Query ───────────────────────────────────

export interface TechArticleFilter {
  search?: string;
  technologyCategory?: TechCategory;
  projectPhases?: ProjectPhase[];
  industries?: IndustrySector[];
  impactLevel?: ImpactLevel;
  eventType?: TechEventType;
  status?: ArticleStatus;
  language?: string;
  sourceId?: string;
  dateFrom?: string;
  dateTo?: string;
  isBookmarked?: boolean;
  sortBy?: 'newest' | 'impact' | 'views';
  page?: number;
  pageSize?: number;
}

// ─── AI Analysis Result ───────────────────────────────

export interface ArticleAnalysisResult {
  titleVi: string;
  summaryVi: string;
  contentVi?: string;
  technologies: string[];
  technologyCategory: TechCategory;
  projectPhases: ProjectPhase[];
  industries: IndustrySector[];
  eventType: TechEventType;
  companies: string[];
  deploymentProject?: string;
  valueProposition: string;
  impactLevel: ImpactLevel;
  impactReason: string;
  tags: string[];
}

// ─── Taxonomy Config (Expandable via Admin UI) ────────

export interface TechTaxonomyItem {
  id: string;
  code: string;
  labelVi: string;
  labelEn: string;
  group: 'technology' | 'phase' | 'industry' | 'event';
  parentId?: string;
  isActive: boolean;
  sortOrder: number;
  keywords: string[];
  createdAt: string;
}
