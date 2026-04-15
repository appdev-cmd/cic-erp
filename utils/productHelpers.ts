import { PRODUCT_CATEGORY_MAP } from '../constants';

/** Categories that get auto-prepended to the product name */
export const PREFIXED_CATEGORIES = ['Phần mềm', 'Thiết bị'];

/**
 * Build display name from structured parts.
 * If category is Phần mềm or Thiết bị, prepend it as a prefix.
 */
export const buildProductName = (category: string, line?: string, edition?: string): string => {
    const parts = [line, edition].filter(Boolean);
    if (parts.length === 0) return '';
    const base = parts.join(' ');
    if (PREFIXED_CATEGORIES.includes(category)) {
        return `${category} ${base}`;
    }
    return base;
};

/**
 * Get category code for auto-code generation
 */
export const getCategoryCode = (label: string): string => {
    return PRODUCT_CATEGORY_MAP.find(c => c.label === label)?.code || 'K';
};
