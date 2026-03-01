/**
 * Universal @mention search service for CIC ERP Chat
 * Searches across: Users, Contracts, Customers, Products, Units, Documents
 * Returns typed results with navigation routes
 */
import { dataClient } from '../lib/dataClient';

export type MentionType = 'user' | 'contract' | 'customer' | 'product' | 'unit';

export interface MentionResult {
    type: MentionType;
    id: string;
    label: string;         // Display name
    sublabel?: string;     // Secondary info (e.g. contract code, email)
    icon: string;          // Emoji icon
    route: string;         // Navigation path when clicked
}

// Category definitions for the dropdown tabs
export const MENTION_CATEGORIES: { type: MentionType; label: string; icon: string }[] = [
    { type: 'user', label: 'Nhân viên', icon: '👤' },
    { type: 'contract', label: 'Hợp đồng', icon: '📋' },
    { type: 'customer', label: 'Khách hàng', icon: '🏢' },
    { type: 'product', label: 'Sản phẩm/DV', icon: '📦' },
    { type: 'unit', label: 'Đơn vị', icon: '🏗️' },
];

/**
 * Search across all entity types
 * Returns max 5 results per category (up to 25 total)
 */
export async function searchMentions(
    query: string,
    excludeUserId?: string
): Promise<MentionResult[]> {
    const q = query.trim().toLowerCase();

    // Run all searches in parallel
    const [users, contracts, customers, products, units] = await Promise.all([
        searchUsers(q, excludeUserId),
        searchContracts(q),
        searchCustomers(q),
        searchProducts(q),
        searchUnits(q),
    ]);

    return [...users, ...contracts, ...customers, ...products, ...units];
}

/** Search by category */
export async function searchMentionsByType(
    type: MentionType,
    query: string,
    excludeUserId?: string
): Promise<MentionResult[]> {
    const q = query.trim().toLowerCase();
    switch (type) {
        case 'user': return searchUsers(q, excludeUserId);
        case 'contract': return searchContracts(q);
        case 'customer': return searchCustomers(q);
        case 'product': return searchProducts(q);
        case 'unit': return searchUnits(q);
        default: return [];
    }
}

// ─── Individual search functions ──────────────────────────

async function searchUsers(q: string, excludeUserId?: string): Promise<MentionResult[]> {
    let query = dataClient
        .from('profiles')
        .select('id, full_name, email, avatar_url')
        .ilike('full_name', `%${q}%`)
        .limit(5);

    if (excludeUserId) {
        query = query.neq('id', excludeUserId);
    }

    const { data } = await query;
    return (data || []).map((u: any) => ({
        type: 'user' as MentionType,
        id: u.id,
        label: u.full_name || 'Unknown',
        sublabel: u.email,
        icon: '👤',
        route: `/personnel/${u.id}`,
    }));
}

async function searchContracts(q: string): Promise<MentionResult[]> {
    const { data } = await dataClient
        .from('contracts')
        .select('id, title, customer_contract_number, status')
        .or(`title.ilike.%${q}%,customer_contract_number.ilike.%${q}%`)
        .limit(5);

    return (data || []).map((c: any) => ({
        type: 'contract' as MentionType,
        id: c.id,
        label: c.title || 'Hợp đồng',
        sublabel: c.customer_contract_number ? `Mã: ${c.customer_contract_number}` : c.status,
        icon: '📋',
        route: `/contracts/${c.id}`,
    }));
}

async function searchCustomers(q: string): Promise<MentionResult[]> {
    const { data } = await dataClient
        .from('customers')
        .select('id, name, tax_code, email')
        .or(`name.ilike.%${q}%,tax_code.ilike.%${q}%`)
        .limit(5);

    return (data || []).map((c: any) => ({
        type: 'customer' as MentionType,
        id: c.id,
        label: c.name || 'Khách hàng',
        sublabel: c.tax_code ? `MST: ${c.tax_code}` : c.email,
        icon: '🏢',
        route: `/customers/${c.id}`,
    }));
}

async function searchProducts(q: string): Promise<MentionResult[]> {
    const { data } = await dataClient
        .from('products')
        .select('id, name, code, unit')
        .or(`name.ilike.%${q}%,code.ilike.%${q}%`)
        .limit(5);

    return (data || []).map((p: any) => ({
        type: 'product' as MentionType,
        id: p.id,
        label: p.name || 'Sản phẩm',
        sublabel: p.code ? `Mã: ${p.code}` : p.unit,
        icon: '📦',
        route: `/products/${p.id}`,
    }));
}

async function searchUnits(q: string): Promise<MentionResult[]> {
    const { data } = await dataClient
        .from('units')
        .select('id, name, code, type')
        .or(`name.ilike.%${q}%,code.ilike.%${q}%`)
        .limit(5);

    return (data || []).map((u: any) => ({
        type: 'unit' as MentionType,
        id: u.id,
        label: u.name || 'Đơn vị',
        sublabel: u.code ? `Mã: ${u.code}` : u.type,
        icon: '🏗️',
        route: `/units/${u.id}`,
    }));
}

/**
 * Encode a mention into message text format: @[type:id:label]
 * This format is stored in the message content and parsed during rendering
 */
export function encodeMention(result: MentionResult): string {
    return `@[${result.type}:${result.id}:${result.label}]`;
}

/**
 * Parse mentions from message text
 * Pattern: @[type:id:label]
 */
export function parseMentions(text: string): {
    parts: { type: 'text' | 'mention'; content: string; mention?: MentionResult }[];
} {
    const regex = /@\[(user|contract|customer|product|unit):([^:]+):([^\]]+)\]/g;
    const parts: { type: 'text' | 'mention'; content: string; mention?: MentionResult }[] = [];
    let lastIndex = 0;
    let match;

    while ((match = regex.exec(text)) !== null) {
        // Add text before this mention
        if (match.index > lastIndex) {
            parts.push({ type: 'text', content: text.slice(lastIndex, match.index) });
        }

        const type = match[1] as MentionType;
        const id = match[2];
        const label = match[3];
        const iconMap: Record<MentionType, string> = { user: '👤', contract: '📋', customer: '🏢', product: '📦', unit: '🏗️' };
        const routeMap: Record<MentionType, string> = {
            user: `/personnel/${id}`,
            contract: `/contracts/${id}`,
            customer: `/customers/${id}`,
            product: `/products/${id}`,
            unit: `/units/${id}`,
        };

        parts.push({
            type: 'mention',
            content: match[0],
            mention: { type, id, label, icon: iconMap[type], route: routeMap[type] },
        });

        lastIndex = match.index + match[0].length;
    }

    // Add remaining text
    if (lastIndex < text.length) {
        parts.push({ type: 'text', content: text.slice(lastIndex) });
    }

    return { parts };
}
