import { dataClient as supabase } from '../lib/dataClient';
import { NewsPost, PostStatus, PostCategory } from '../types/news';

export class NewsService {
    // Convert from DB snake_case to UI camelCase
    private static toNewsPost(row: any): NewsPost {
        return {
            id: row.id,
            titleVi: row.title_vi || '',
            titleEn: row.title_en || undefined,
            slug: row.slug || '',
            excerptVi: row.excerpt_vi || undefined,
            excerptEn: row.excerpt_en || undefined,
            contentVi: row.content_vi || undefined,
            contentEn: row.content_en || undefined,
            thumbnailUrl: row.thumbnail_url || undefined,
            categoryId: row.category_id || undefined,
            categoryNameVi: row.cms_categories?.name_vi || undefined,
            authorName: row.author_name || undefined,
            publishedAt: row.published_at || undefined,
            status: (row.status as PostStatus) || 'draft',
            isFeatured: !!row.is_featured,
            viewCount: row.view_count || 0,
            seoTitleVi: row.seo_title_vi || undefined,
            seoTitleEn: row.seo_title_en || undefined,
            seoDescriptionVi: row.seo_description_vi || undefined,
            seoDescriptionEn: row.seo_description_en || undefined,
            tags: row.tags || undefined,
            createdAt: row.created_at,
            updatedAt: row.updated_at,
        };
    }

    // Convert from UI camelCase to DB snake_case
    private static toRow(post: Partial<NewsPost>): any {
        const row: any = {};
        if (post.titleVi !== undefined) row.title_vi = post.titleVi;
        if (post.titleEn !== undefined) row.title_en = post.titleEn;
        if (post.slug !== undefined) row.slug = post.slug;
        if (post.excerptVi !== undefined) row.excerpt_vi = post.excerptVi;
        if (post.excerptEn !== undefined) row.excerpt_en = post.excerptEn;
        if (post.contentVi !== undefined) row.content_vi = post.contentVi;
        if (post.contentEn !== undefined) row.content_en = post.contentEn;
        if (post.thumbnailUrl !== undefined) row.thumbnail_url = post.thumbnailUrl;
        if (post.categoryId !== undefined) row.category_id = post.categoryId;
        if (post.authorName !== undefined) row.author_name = post.authorName;
        if (post.publishedAt !== undefined) row.published_at = post.publishedAt;
        if (post.status !== undefined) row.status = post.status;
        if (post.isFeatured !== undefined) row.is_featured = post.isFeatured;
        if (post.viewCount !== undefined) row.view_count = post.viewCount;
        if (post.seoTitleVi !== undefined) row.seo_title_vi = post.seoTitleVi;
        if (post.seoTitleEn !== undefined) row.seo_title_en = post.seoTitleEn;
        if (post.seoDescriptionVi !== undefined) row.seo_description_vi = post.seoDescriptionVi;
        if (post.seoDescriptionEn !== undefined) row.seo_description_en = post.seoDescriptionEn;
        if (post.tags !== undefined) row.tags = post.tags;
        return row;
    }

    static async getCategories(): Promise<PostCategory[]> {
        const { data, error } = await supabase
            .from('cms_categories')
            .select('*')
            .order('created_at', { ascending: true });
            
        if (error) throw error;
        
        // Map to PostCategory UI model
        return (data as any[]).map(r => ({
            id: r.id,
            nameVi: r.name_vi,
            nameEn: r.name_en,
            slug: r.slug,
            descriptionVi: r.description_vi,
            descriptionEn: r.description_en,
            parentId: r.parent_id,
            type: r.type,
            sortOrder: r.sort_order,
            isActive: !!r.is_active,
            imageUrl: r.image_url,
            seoTitleVi: r.seo_title_vi,
            seoDescriptionVi: r.seo_description_vi
        }));
    }

    static async getAll(): Promise<NewsPost[]> {
        const { data, error } = await supabase
            .from('cms_posts')
            .select(`
                *,
                cms_categories(id, name_vi, slug)
            `)
            .order('created_at', { ascending: false });

        if (error) throw error;
        return (data || []).map(this.toNewsPost);
    }

    static async getById(id: string): Promise<NewsPost | null> {
        const { data, error } = await supabase
            .from('cms_posts')
            .select(`
                *,
                cms_categories(id, name_vi, slug)
            `)
            .eq('id', id);

        if (error) throw error;
        if (!data || data.length === 0) return null;
        return this.toNewsPost(data[0]);
    }

    static async getBySlug(slug: string): Promise<NewsPost | null> {
        const { data, error } = await supabase
            .from('cms_posts')
            .select(`
                *,
                cms_categories(id, name_vi, slug)
            `)
            .eq('slug', slug);

        if (error) throw error;
        if (!data || data.length === 0) return null;
        return this.toNewsPost(data[0]);
    }

    static async create(post: Partial<NewsPost>): Promise<NewsPost> {
        const row = this.toRow(post);
        const { data, error } = await supabase
            .from('cms_posts')
            .insert([row])
            .select(`
                *,
                cms_categories(id, name_vi, slug)
            `);

        if (error) throw error;
        if (!data || data.length === 0) throw new Error("Không thể tạo dữ liệu mới.");
        return this.toNewsPost(data[0]);
    }

    static async update(id: string, post: Partial<NewsPost>): Promise<NewsPost> {
        const row = this.toRow(post);
        row.updated_at = new Date().toISOString();

        const { data, error } = await supabase
            .from('cms_posts')
            .update(row)
            .eq('id', id)
            .select(`
                *,
                cms_categories(id, name_vi, slug)
            `);

        if (error) throw error;
        if (!data || data.length === 0) {
            throw new Error("Không thể cập nhật. Lỗi phiên đăng nhập hoặc bị từ chối bởi quyền RLS.");
        }
        return this.toNewsPost(data[0]);
    }

    static async delete(id: string): Promise<void> {
        const { error } = await supabase
            .from('cms_posts')
            .delete()
            .eq('id', id);

        if (error) throw error;
    }
}
