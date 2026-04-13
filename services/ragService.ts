import { supabase } from '../lib/supabase';
import { getLocalAIBaseURL } from './ai';

// ============================================
// Embedding Providers
// ============================================

type EmbeddingProvider = 'local' | 'gemini';

/**
 * Lấy provider embedding hiện tại từ settings (localStorage)
 */
function getEmbeddingProvider(): EmbeddingProvider {
    if (typeof window !== 'undefined') {
        return (localStorage.getItem('cic-embedding-provider') as EmbeddingProvider) || 'local';
    }
    return 'local';
}

/**
 * Gọi API Local (Ollama) để nhúng văn bản thành vector
 * Model: nomic-embed-text (768 dimensions)
 */
export async function generateLocalEmbedding(text: string): Promise<number[]> {
    let baseURL = getLocalAIBaseURL();
    if (!baseURL.endsWith('/v1')) {
        baseURL = baseURL.replace(/\/$/, '') + '/v1';
    }

    try {
        const response = await fetch(`${baseURL}/embeddings`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer local-embedding`
            },
            body: JSON.stringify({
                model: 'nomic-embed-text',
                input: text
            })
        });

        if (!response.ok) {
            throw new Error(`Embedding failed: ${response.statusText}`);
        }

        const data = await response.json();
        if (!data.data || !data.data[0] || !data.data[0].embedding) {
            throw new Error('Invalid embedding response. Ensure nomic-embed-text is pulled.');
        }

        return data.data[0].embedding;
    } catch (e) {
        console.error("Local embedding error:", e);
        throw e;
    }
}

/**
 * Gọi Gemini Embedding API (text-embedding-004)
 * Miễn phí 1500 req/phút, 768 dimensions
 */
export async function generateGeminiEmbedding(text: string): Promise<number[]> {
    // Gemini API key from settings
    const apiKey = typeof window !== 'undefined'
        ? localStorage.getItem('cic-gemini-api-key') || ''
        : '';

    if (!apiKey) {
        throw new Error('Gemini API key chưa được cấu hình. Vào Cài đặt → AI để thêm.');
    }

    const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/text-embedding-004:embedContent?key=${apiKey}`,
        {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model: 'models/text-embedding-004',
                content: { parts: [{ text }] },
                taskType: 'RETRIEVAL_DOCUMENT',
                outputDimensionality: 768,
            })
        }
    );

    if (!response.ok) {
        const err = await response.text();
        throw new Error(`Gemini embedding failed: ${err}`);
    }

    const data = await response.json();
    if (!data.embedding || !data.embedding.values) {
        throw new Error('Invalid Gemini embedding response format.');
    }

    return data.embedding.values;
}

/**
 * Sinh embedding tự động dựa trên provider đã chọn (Admin chọn trong Settings)
 */
export async function generateEmbedding(text: string): Promise<number[]> {
    const provider = getEmbeddingProvider();
    if (provider === 'gemini') {
        return generateGeminiEmbedding(text);
    }
    return generateLocalEmbedding(text);
}

// ============================================
// Knowledge Base Search
// ============================================

interface SearchOptions {
    limit?: number;
    threshold?: number;
    category?: string;
    entityType?: string;
    entityId?: string;
}

/**
 * Tìm kiếm RAG thông qua `pgvector` — dùng bảng document_chunks mới
 * Fallback sang app_documents cũ nếu match_document_chunks chưa có data
 */
export async function searchKnowledgeBase(query: string, options: SearchOptions | number = 3): Promise<string> {
    const opts: SearchOptions = typeof options === 'number' ? { limit: options } : options;
    const { limit = 3, threshold = 0.5, category, entityType, entityId } = opts;

    try {
        const embedding = await generateEmbedding(query);

        // Thử bảng mới trước (document_chunks)
        const { data: newData, error: newError } = await supabase.rpc('match_document_chunks', {
            query_embedding: embedding,
            match_threshold: threshold,
            match_count: limit,
            filter_category: category || null,
            filter_entity_type: entityType || null,
            filter_entity_id: entityId || null,
        });

        if (!newError && newData && newData.length > 0) {
            return newData.map((chunk: any) =>
                `[Tài liệu: ${chunk.doc_title} | Danh mục: ${chunk.doc_category}]\n${chunk.content}`
            ).join('\n\n');
        }

        // Fallback: bảng app_documents cũ
        const { data, error } = await supabase.rpc('match_app_documents', {
            query_embedding: embedding,
            match_threshold: threshold,
            match_count: limit
        });

        if (error) throw error;
        if (!data || data.length === 0) return "";

        return data.map((doc: any) => `[Trích xuất tài liệu - Nội suy hệ thống: ${doc.title}]\n${doc.content}`).join('\n\n');
    } catch (e) {
        console.error("Knowledge base search error:", e);
        // Trả về rỗng nếu không tìm kiếm được (phòng lỗi sập hệ thống AI nếu server RAG không bật)
        return "";
    }
}
