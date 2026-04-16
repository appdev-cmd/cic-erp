/**
 * Product/Service category type — kept as string for extensibility
 */
export type ProductCategory = string;

/**
 * License type for structured product naming
 */
export type LicenseType = 'Standalone' | 'Network' | 'Hardlock';

/**
 * Represents a brand/manufacturer
 */
export interface Brand {
  id: string;
  name: string;
  code?: string;
  logoUrl?: string;
  website?: string;
  country?: string;
  description?: string;
  isActive: boolean;
  totalContractValue?: number;
  totalRevenue?: number;
  productCount?: number;
  createdAt?: string;
  updatedAt?: string;
}

/**
 * Represents a product-supplier relationship (N:N)
 */
export interface ProductSupplier {
  id: string;
  productId: string;
  supplierId: string;
  isPrimary: boolean;
  supplierPrice: number;
  discountPercent: number;
  leadTimeDays?: number;
  notes?: string;
  createdAt?: string;
  // Joined fields for display
  supplierName?: string;
}

/**
 * Represents a product or service offering
 */
export interface Product {
  id: string;
  code: string;
  name: string;
  category: ProductCategory;
  description: string;
  unit: string; // đơn vị tính: gói, m2, ngày công, etc.
  basePrice: number;
  costPrice?: number;
  isActive: boolean;
  unitId?: string; // đơn vị kinh doanh phụ trách
  // Structured Name Builder fields (all optional — some products only have a name)
  productLine?: string;    // Dòng sản phẩm (VD: CIC Document, PLAXIS, SAP2000)
  edition?: string;        // Phiên bản (VD: Standard, Pro, Ultimate)
  licenseType?: LicenseType; // Loại license (Standalone, Network, Hardlock)
  // CRM fields — Brand & Supplier linkage
  brandId?: string;
  supplierId?: string; // NCC chính
  sku?: string;
  model?: string;
  warrantyMonths?: number;
  // Joined fields for display
  brandName?: string;
  supplierName?: string;
  // Web Integration fields
  isPublishedWeb?: boolean;
  isFeaturedWeb?: boolean;
  slug?: string;
  summary?: string;
  seoTitle?: string;
  seoDescription?: string;
  viewCount?: number;
  featuresDetails?: string;
  systemRequirements?: string;
  videoUrl?: string;
  brochureUrl?: string;
  demoUrl?: string;
  totalContractValue?: number;
  totalRevenue?: number;
  createdAt?: string;
  updatedAt?: string;
}
