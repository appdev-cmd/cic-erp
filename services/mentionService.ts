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
    // Vietnamese diacritics-insensitive search via RPC
    let matchedIds: string[] | undefined;
    try {
        const { data: rpcData } = await dataClient.rpc('search_mentions_unaccent', { search_term: q });
        if (rpcData && rpcData.length > 0) {
            matchedIds = rpcData.map((r: any) => r.id);
        }
    } catch (e) {
        // RPC not available — fall back to ilike
    }

    let query = dataClient
        .from('profiles')
        .select('id, full_name, email, avatar_url');

    if (matchedIds && matchedIds.length > 0) {
        query = query.in('id', matchedIds);
    } else if (!matchedIds) {
        query = query.ilike('full_name', `%${q}%`);
    } else {
        return []; // RPC ok, no results
    }

    query = query.limit(5);

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

/**
 * AI Helper: Parse và lấy ra Context mô tả các mention cho LLM
 */
export function extractMentionContextFromText(text: string): {
    cleanText: string;
    contextString: string;
} {
    const mentionSet = new Set<string>();
    const typeLabels: Record<MentionType, string> = {
        user: 'nhân sự',
        contract: 'hợp đồng',
        customer: 'khách hàng',
        product: 'sản phẩm',
        unit: 'đơn vị',
    };

    // Step 1: Extract hidden markdown comment mentions: [//]: # (@[type:id:label])
    const hiddenRegex = /\[\/\/\]: # \(@\[(user|contract|customer|product|unit):([^:]+):([^\]]+)\]\)/g;
    let hiddenMatch;
    while ((hiddenMatch = hiddenRegex.exec(text)) !== null) {
        const type = hiddenMatch[1] as MentionType;
        const id = hiddenMatch[2];
        const label = hiddenMatch[3];
        const t = typeLabels[type] || type;
        mentionSet.add(`- ${t} "${label}" (ID: ${id})`);
    }
    // Remove hidden comments from text
    let cleanedText = text.replace(/\n?\[\/\/\]: # \(@\[[^\]]+\]\)/g, '').trim();

    // Step 2: Also extract inline @[type:id:label] mentions (legacy format)
    const { parts } = parseMentions(cleanedText);
    let cleanText = '';
    for (const p of parts) {
        if (p.type === 'text') {
            cleanText += p.content;
        } else if (p.mention) {
            cleanText += p.mention.label;
            const t = typeLabels[p.mention.type] || p.mention.type;
            mentionSet.add(`- ${t} "${p.mention.label}" (ID: ${p.mention.id})`);
        }
    }

    let contextString = '';
    if (mentionSet.size > 0) {
        contextString = `\n[CONTEXT] User đang đề cập đến các đối tượng sau trên hệ thống. Hãy ưu tiên sử dụng thông tin và ID này khi gọi tool:\n` + 
                        Array.from(mentionSet).join('\n');
    }

    return { cleanText: cleanText || cleanedText, contextString };
}

