export interface CmsService {
    id: string;
    nameVi: string;
    nameEn?: string;
    slug: string;
    descriptionVi?: string;
    descriptionEn?: string;
    contentVi?: string;
    contentEn?: string;
    iconUrl?: string;
    thumbnailUrl?: string;
    isActive: boolean;
    sortOrder: number;
    seoTitleVi?: string;
    seoTitleEn?: string;
    seoDescriptionVi?: string;
    seoDescriptionEn?: string;
    createdAt?: string;
    updatedAt?: string;
}

export interface CmsBanner {
    id: string;
    titleVi?: string;
    titleEn?: string;
    subtitleVi?: string;
    subtitleEn?: string;
    imageUrl: string;
    linkUrl?: string;
    sortOrder: number;
    isActive: boolean;
    position: 'left' | 'right' | string;
    startDate?: string;
    endDate?: string;
    createdAt?: string;
}
