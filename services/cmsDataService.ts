import { dataClient as supabase } from '../lib/dataClient';
import { CmsService, CmsBanner } from '../types/cms';

export class CmsDataService {
    // ----------------------------------------
    // SERVICE METHODS
    // ----------------------------------------
    private static toService(row: any): CmsService {
        return {
            id: row.id,
            nameVi: row.name_vi,
            nameEn: row.name_en || undefined,
            slug: row.slug,
            descriptionVi: row.description_vi || undefined,
            descriptionEn: row.description_en || undefined,
            contentVi: row.content_vi || undefined,
            contentEn: row.content_en || undefined,
            iconUrl: row.icon_url || undefined,
            thumbnailUrl: row.thumbnail_url || undefined,
            isActive: !!row.is_active,
            sortOrder: row.sort_order || 0,
            seoTitleVi: row.seo_title_vi || undefined,
            seoTitleEn: row.seo_title_en || undefined,
            seoDescriptionVi: row.seo_description_vi || undefined,
            seoDescriptionEn: row.seo_description_en || undefined,
            createdAt: row.created_at,
            updatedAt: row.updated_at,
        };
    }

    private static toServiceRow(service: Partial<CmsService>): any {
        const row: any = {};
        if (service.nameVi !== undefined) row.name_vi = service.nameVi;
        if (service.nameEn !== undefined) row.name_en = service.nameEn;
        if (service.slug !== undefined) row.slug = service.slug;
        if (service.descriptionVi !== undefined) row.description_vi = service.descriptionVi;
        if (service.descriptionEn !== undefined) row.description_en = service.descriptionEn;
        if (service.contentVi !== undefined) row.content_vi = service.contentVi;
        if (service.contentEn !== undefined) row.content_en = service.contentEn;
        if (service.iconUrl !== undefined) row.icon_url = service.iconUrl;
        if (service.thumbnailUrl !== undefined) row.thumbnail_url = service.thumbnailUrl;
        if (service.isActive !== undefined) row.is_active = service.isActive;
        if (service.sortOrder !== undefined) row.sort_order = service.sortOrder;
        if (service.seoTitleVi !== undefined) row.seo_title_vi = service.seoTitleVi;
        if (service.seoTitleEn !== undefined) row.seo_title_en = service.seoTitleEn;
        if (service.seoDescriptionVi !== undefined) row.seo_description_vi = service.seoDescriptionVi;
        if (service.seoDescriptionEn !== undefined) row.seo_description_en = service.seoDescriptionEn;
        return row;
    }

    static async getServices(): Promise<CmsService[]> {
        const { data, error } = await supabase
            .from('cms_services')
            .select('*')
            .order('sort_order', { ascending: true })
            .order('created_at', { ascending: false });
        if (error) throw error;
        return (data || []).map(this.toService);
    }

    static async createService(service: Partial<CmsService>): Promise<CmsService> {
        const row = this.toServiceRow(service);
        const { data, error } = await supabase.from('cms_services').insert([row]).select();
        if (error) throw error;
        return this.toService(data[0]);
    }

    static async updateService(id: string, service: Partial<CmsService>): Promise<CmsService> {
        const row = this.toServiceRow(service);
        row.updated_at = new Date().toISOString();
        const { data, error } = await supabase.from('cms_services').update(row).eq('id', id).select();
        if (error) throw error;
        return this.toService(data[0]);
    }

    static async deleteService(id: string): Promise<void> {
        const { error } = await supabase.from('cms_services').delete().eq('id', id);
        if (error) throw error;
    }


    // ----------------------------------------
    // BANNER METHODS
    // ----------------------------------------
    private static toBanner(row: any): CmsBanner {
        return {
            id: row.id,
            titleVi: row.title_vi || undefined,
            titleEn: row.title_en || undefined,
            subtitleVi: row.subtitle_vi || undefined,
            subtitleEn: row.subtitle_en || undefined,
            imageUrl: row.image_url,
            linkUrl: row.link_url || undefined,
            sortOrder: row.sort_order || 0,
            isActive: !!row.is_active,
            position: row.position || 'left',
            startDate: row.start_date || undefined,
            endDate: row.end_date || undefined,
            createdAt: row.created_at,
        };
    }

    private static toBannerRow(banner: Partial<CmsBanner>): any {
        const row: any = {};
        if (banner.titleVi !== undefined) row.title_vi = banner.titleVi;
        if (banner.titleEn !== undefined) row.title_en = banner.titleEn;
        if (banner.subtitleVi !== undefined) row.subtitle_vi = banner.subtitleVi;
        if (banner.subtitleEn !== undefined) row.subtitle_en = banner.subtitleEn;
        if (banner.imageUrl !== undefined) row.image_url = banner.imageUrl;
        if (banner.linkUrl !== undefined) row.link_url = banner.linkUrl;
        if (banner.sortOrder !== undefined) row.sort_order = banner.sortOrder;
        if (banner.isActive !== undefined) row.is_active = banner.isActive;
        if (banner.position !== undefined) row.position = banner.position;
        if (banner.startDate !== undefined) row.start_date = banner.startDate;
        if (banner.endDate !== undefined) row.end_date = banner.endDate;
        return row;
    }

    static async getBanners(): Promise<CmsBanner[]> {
        const { data, error } = await supabase
            .from('cms_banners')
            .select('*')
            .order('sort_order', { ascending: true })
            .order('created_at', { ascending: false });
        if (error) throw error;
        return (data || []).map(this.toBanner);
    }

    static async createBanner(banner: Partial<CmsBanner>): Promise<CmsBanner> {
        const row = this.toBannerRow(banner);
        const { data, error } = await supabase.from('cms_banners').insert([row]).select();
        if (error) throw error;
        return this.toBanner(data[0]);
    }

    static async updateBanner(id: string, banner: Partial<CmsBanner>): Promise<CmsBanner> {
        const row = this.toBannerRow(banner);
        const { data, error } = await supabase.from('cms_banners').update(row).eq('id', id).select();
        if (error) throw error;
        return this.toBanner(data[0]);
    }

    static async deleteBanner(id: string): Promise<void> {
        const { error } = await supabase.from('cms_banners').delete().eq('id', id);
        if (error) throw error;
    }
}
