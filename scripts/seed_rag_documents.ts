/**
 * Script nạp tài liệu nội bộ vào Supabase RAG (Knowledge Base)
 * 
 * Cách chạy:
 *   npx tsx scripts/seed_rag_documents.ts
 * 
 * Yêu cầu:
 *   - Ollama đang chạy (ollama serve) với model nomic-embed-text
 *   - File .env có VITE_SUPABASE_URL và VITE_SUPABASE_ANON_KEY
 *   - Các file .md trong thư mục docs/
 */

import { readFileSync, readdirSync, existsSync } from 'fs';
import { join, basename } from 'path';
import { createClient } from '@supabase/supabase-js';

// Parse .env file manually (no dotenv dependency)
function loadEnv() {
    // Try .env.local first (Vite convention), then .env
    const candidates = [join(process.cwd(), '.env.local'), join(process.cwd(), '.env')];
    for (const envPath of candidates) {
        if (!existsSync(envPath)) continue;
        const content = readFileSync(envPath, 'utf-8');
        for (const line of content.split('\n')) {
            const trimmed = line.replace(/\r/g, '').trim();
            if (!trimmed || trimmed.startsWith('#')) continue;
            const eqIdx = trimmed.indexOf('=');
            if (eqIdx < 0) continue;
            const key = trimmed.slice(0, eqIdx).trim();
            let val = trimmed.slice(eqIdx + 1).trim();
            // Remove surrounding quotes
            if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
                val = val.slice(1, -1);
            }
            if (!process.env[key]) process.env[key] = val;
        }
    }
}
loadEnv();

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;
const OLLAMA_HOST = process.env.OLLAMA_HOST || 'http://localhost:11434';
const EMBEDDING_MODEL = 'nomic-embed-text';
const DOCS_DIR = join(process.cwd(), 'docs');
const CHUNK_SIZE = 500; // words per chunk
const CHUNK_OVERLAP = 50;

if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.error('❌ Missing SUPABASE_URL or SUPABASE_KEY in .env');
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
    auth: { persistSession: false }
});

// ─── Embedding ────────────────────────────────────────────
async function getEmbedding(text: string): Promise<number[]> {
    const res = await fetch(`${OLLAMA_HOST}/v1/embeddings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            model: EMBEDDING_MODEL,
            input: text.slice(0, 8000)
        })
    });

    if (!res.ok) {
        throw new Error(`Embedding failed: ${res.status} ${await res.text()}`);
    }

    const data = await res.json() as { data: { embedding: number[] }[] };
    return data.data[0].embedding;
}

// ─── Chunking ─────────────────────────────────────────────
function chunkText(text: string, chunkSize: number = CHUNK_SIZE, overlap: number = CHUNK_OVERLAP): string[] {
    const words = text.split(/\s+/);
    const chunks: string[] = [];
    
    for (let i = 0; i < words.length; i += chunkSize - overlap) {
        const chunk = words.slice(i, i + chunkSize).join(' ');
        if (chunk.trim().length > 50) {
            chunks.push(chunk.trim());
        }
    }
    
    return chunks;
}

// ─── Read Markdown files ──────────────────────────────────
function readDocs(): { filename: string; title: string; content: string }[] {
    const files = readdirSync(DOCS_DIR).filter(f => f.endsWith('.md'));
    
    return files.map(f => {
        const content = readFileSync(join(DOCS_DIR, f), 'utf-8');
        // Extract title from first # heading
        const titleMatch = content.match(/^#\s+(.+)/m);
        const title = titleMatch ? titleMatch[1].trim() : basename(f, '.md');
        return { filename: f, title, content };
    });
}

// ─── Main ─────────────────────────────────────────────────
async function main() {
    console.log('🚀 CIC-ERP RAG Document Seeder');
    console.log(`   Supabase: ${SUPABASE_URL}`);
    console.log(`   Ollama: ${OLLAMA_HOST}`);
    console.log(`   Docs dir: ${DOCS_DIR}`);
    console.log('');

    // Test Ollama connection
    try {
        const test = await fetch(`${OLLAMA_HOST}/api/tags`);
        if (!test.ok) throw new Error('Cannot connect');
        console.log('✅ Ollama connected');
    } catch {
        console.error('❌ Cannot connect to Ollama. Run: ollama serve');
        process.exit(1);
    }

    // Test embedding model
    try {
        await getEmbedding('test');
        console.log(`✅ Embedding model "${EMBEDDING_MODEL}" ready`);
    } catch (e) {
        console.error(`❌ Embedding model not found. Run: ollama pull ${EMBEDDING_MODEL}`);
        process.exit(1);
    }

    // Read documents
    const docs = readDocs();
    console.log(`\n📄 Found ${docs.length} documents:`);
    docs.forEach(d => console.log(`   - ${d.filename} → "${d.title}"`));

    // Clear existing documents (optional, idempotent)
    console.log('\n🗑️  Clearing existing documents...');
    const { error: delError } = await supabase
        .from('app_documents')
        .delete()
        .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all
    if (delError) {
        console.warn('⚠️  Delete warning:', delError.message);
    }

    // Process each document
    let totalChunks = 0;
    for (const doc of docs) {
        console.log(`\n📝 Processing: ${doc.filename}`);
        const chunks = chunkText(doc.content);
        console.log(`   ${chunks.length} chunks`);

        for (let i = 0; i < chunks.length; i++) {
            const chunkTitle = `${doc.title} (${i + 1}/${chunks.length})`;
            const chunk = chunks[i];

            try {
                // Get embedding
                const embedding = await getEmbedding(chunk);

                // Insert into Supabase
                const { error } = await supabase
                    .from('app_documents')
                    .insert({
                        title: chunkTitle,
                        content: chunk,
                        embedding,
                        metadata: {
                            source: doc.filename,
                            chunk_index: i,
                            total_chunks: chunks.length,
                            category: 'internal_docs',
                            seeded_at: new Date().toISOString()
                        }
                    });

                if (error) {
                    console.error(`   ❌ Chunk ${i + 1}: ${error.message}`);
                } else {
                    console.log(`   ✅ Chunk ${i + 1}/${chunks.length}: "${chunkTitle.slice(0, 60)}..."`);
                    totalChunks++;
                }
            } catch (e) {
                console.error(`   ❌ Chunk ${i + 1}: ${e instanceof Error ? e.message : String(e)}`);
            }

            // Small delay to avoid overwhelming Ollama
            await new Promise(r => setTimeout(r, 200));
        }
    }

    console.log(`\n🎉 Done! Seeded ${totalChunks} chunks from ${docs.length} documents.`);
    console.log('   AI giờ có thể trả lời dựa trên tài liệu nội bộ! 🧠');
}

main().catch(e => {
    console.error('Fatal error:', e);
    process.exit(1);
});
