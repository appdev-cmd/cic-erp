// ============================================
// TIN TỨC SỰ KIỆN (CMS Posts)
// Dựa trên bảng `cms_posts` và `cms_categories`
// ============================================

export type PostStatus = 'draft' | 'pending_approval' | 'approved' | 'published' | 'archived';

export interface PostCategory {
  id: string;
  nameVi: string;
  nameEn?: string;
  slug: string;
  descriptionVi?: string;
  descriptionEn?: string;
  parentId?: string;
  type: string;
  sortOrder?: number;
  isActive: boolean;
  imageUrl?: string;
  seoTitleVi?: string;
  seoDescriptionVi?: string;
}

export interface NewsPost {
  id: string;
  titleVi: string;
  titleEn?: string;
  slug: string;
  excerptVi?: string;
  excerptEn?: string;
  contentVi?: string;
  contentEn?: string;
  thumbnailUrl?: string;
  categoryId?: string;
  categoryNameVi?: string; // Tên danh mục (Map từ bảng cms_categories)
  authorName?: string; // Dùng thay author_id nếu hệ thống CMS lưu trực tiếp string
  publishedAt?: string;
  status: PostStatus;
  isFeatured: boolean;
  viewCount: number;
  seoTitleVi?: string;
  seoTitleEn?: string;
  seoDescriptionVi?: string;
  seoDescriptionEn?: string;
  tags?: string[];
  createdAt: string;
  updatedAt: string;
}
