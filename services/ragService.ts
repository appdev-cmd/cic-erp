import { supabase } from '../lib/supabase';
import { getLocalAIBaseURL } from './openaiService';

/**
 * Gọi API Local để nhúng chuỗi văn bản thành mảng vector (embedding)
 * Chú ý: Cấu hình mặc định dòng máy chủ chạy 'nomic-embed-text'
 */
export async function generateLocalEmbedding(text: string): Promise<number[]> {
    let baseURL = getLocalAIBaseURL();
    // Đảm bảo có /v1 cho OpenAI compat local server (như vLLM hay Ollama tương thích)
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
                model: 'nomic-embed-text', // Sử dụng model local chuyên embedding
                input: text
            })
        });

        if (!response.ok) {
            throw new Error(`Embedding failed: ${response.statusText}`);
        }

        const data = await response.json();
        if (!data.data || !data.data[0] || !data.data[0].embedding) {
            throw new Error('Invalid embedding response format. Please make sure nomic-embed-text is pulled/downloaded.');
        }

        return data.data[0].embedding;
    } catch (e) {
        console.error("Local embedding error:", e);
        throw e;
    }
}

/**
 * Tìm kiếm RAG (Retrieval-Augmented Generation) thông qua `pgvector`
 */
export async function searchKnowledgeBase(query: string, limit = 3): Promise<string> {
    try {
        const embedding = await generateLocalEmbedding(query);

        const { data, error } = await supabase.rpc('match_app_documents', {
            query_embedding: embedding,
            match_threshold: 0.5,
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
