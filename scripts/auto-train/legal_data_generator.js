import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const pdfParse = require('pdf-parse');
const pdf = pdfParse.default || pdfParse;
import mammoth from 'mammoth';
import fetch from 'node-fetch';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Config API - We use vLLM running on localhost with Llama 70B (Or Qwen fallback)
const API_BASE = 'http://127.0.0.1:8000/v1';
const API_KEY = 'cic-local-2026';
const TEACHER_MODEL = 'cic-legal-14b';
const FALLBACK_MODEL = 'cic-legal-14b';

const LEGAL_DOCS_DIR = path.join(__dirname, 'data/legal_docs');
const OUTPUT_FILE = path.join(__dirname, 'dataset/legal_training_data.jsonl');

async function extractTextFromFile(filePath) {
    const ext = path.extname(filePath).toLowerCase();
    if (ext === '.txt') {
        return fs.readFileSync(filePath, 'utf8');
    } else if (ext === '.pdf') {
        const { execSync } = require('child_process');
        try {
            // Dùng pdftotext của hệ thống để trích xuất text chuẩn xác nhất
            const text = execSync(`pdftotext "${filePath}" -`, { encoding: 'utf8', maxBuffer: 100 * 1024 * 1024 });
            return text;
        } catch (e) {
            console.error(`Lỗi trích xuất PDF với pdftotext cho file ${filePath}:`, e.message);
            return '';
        }
    } else if (ext === '.docx') {
        const result = await mammoth.extractRawText({ path: filePath });
        return result.value;
    }
    return '';
}

async function generateQAPairs(chunkText, fileContext, useFallback = false) {
    console.log(`Đang phân tích và sinh Q&A với ${useFallback ? 'Qwen (Fallback)' : 'Llama 70B'}...`);
    const systemPrompt = `Bạn là Trợ lý phân tích Hành chính và Pháp chế Xây dựng chuyên nghiệp (CIC ERP).
Nhiệm vụ của bạn là đọc đoạn VĂN BẢN PHÁP LUẬT sau đây và sinh ra chính xác 3 Cặp Câu Hỏi - Câu Trả Lời (Q&A).

**Quy tắc CỐT LÕI (Từ Kiến trúc Smart2Brain):**
1. **Ép Buộc Trích Dẫn (Citation)**: Câu trả lời (\`a\`) LUÔN LUÔN phải bắt đầu bằng việc trích dẫn rõ căn cứ. Ví dụ: "Dựa theo [Điều 15 - Văn bản ${fileContext}], tôi xin trả lời là: ...".
2. **Ngữ cảnh Phân Tầng (Hierarchical Memory)**: Không bao giờ trả lời trống không kiểu "Luật quy định là", mà luôn phải chỉ đích danh tên văn kiện.
3. Trả về ĐÚNG định dạng JSON Array chứa các Object: { "q": "câu hỏi", "a": "câu trả lời" }. TUYỆT ĐỐI không sinh thêm chữ gì ngoài JSON.

VĂN BẢN (Nguồn: ${fileContext}):`;

    try {
        const response = await fetch(`${API_BASE}/chat/completions`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${API_KEY}`
            },
            body: JSON.stringify({
                model: useFallback ? FALLBACK_MODEL : TEACHER_MODEL,
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: `NỘI DUNG ĐOẠN TRÍCH:\n${chunkText}` }
                ],
                temperature: 0.3,
                max_tokens: 4000
            }),
            signal: AbortSignal.timeout(300000)
        });

        const data = await response.json();
        if (data.error) {
           const errMsg = data.error.message || data.error.toString() || '';
           if (errMsg.includes('does not exist') && !useFallback) {
               return await generateQAPairs(chunkText, fileContext, true);
           }
           throw new Error(errMsg);
        }

        let content = data.choices[0].message.content.trim();
        // Xóa block markdown nếu mô hình cố tình chèn
        if (content.startsWith('```')) {
            content = content.replace(/^```json\n?|^```\n?/g, '').replace(/\n?```$/g, '');
        }

        return JSON.parse(content);
    } catch (err) {
        console.error("Lỗi khi gọi Llama 70B:", err.message);
        return [];
    }
}

async function processDocuments() {
    if (!fs.existsSync(OUTPUT_FILE)) {
        fs.mkdirSync(path.dirname(OUTPUT_FILE), { recursive: true });
        fs.writeFileSync(OUTPUT_FILE, '');
    }

    const files = fs.readdirSync(LEGAL_DOCS_DIR).filter(f => !f.startsWith('.'));
    if (files.length === 0) {
        console.log(`⚠️ Thư mục ${LEGAL_DOCS_DIR} đang trống! Vui lòng thả file .pdf, .docx, .txt vào đây.`);
        return;
    }

    let totalPairs = 0;

    for (const file of files) {
        console.log(`\n📄 Đang xử lý file: ${file}...`);
        const filePath = path.join(LEGAL_DOCS_DIR, file);
        let text = await extractTextFromFile(filePath);
        if (!text.trim()) continue;

        // Cắt text thành từng đoạn (Chunks) khoảng 2000 ký tự (Overlap 200)
        const CHUNK_SIZE = 2000;
        for (let i = 0; i < text.length; i += CHUNK_SIZE) {
            const chunk = text.slice(i, i + CHUNK_SIZE + 200);
            if (chunk.length < 200) continue; 
            
            const pairs = await generateQAPairs(chunk, file);
            if (pairs.length > 0) {
                for (const p of pairs) {
                    const jsonlEntry = {
                        messages: [
                            { role: "system", content: "Bạn là chuyên gia về Quy định và Pháp luật xây dựng của hệ thống CIC ERP. Hãy tư vấn dựa trên điều khoản pháp lý chuẩn xác." },
                            { role: "user", content: p.q },
                            { role: "assistant", content: p.a }
                        ]
                    };
                    fs.appendFileSync(OUTPUT_FILE, JSON.stringify(jsonlEntry) + '\n');
                    totalPairs++;
                }
                console.log(` -> Đã sinh và lưu ${pairs.length} cặp Q&A.`);
            }
        }
    }

    console.log(`\n🎉 HOÀN TẤT! Đã chiết xuất tổng cộng ${totalPairs} cặp Q&A để dạy cho Qwen 3.5.`);
    console.log(`Đã xuất ra tệp dataset Training: ${OUTPUT_FILE}`);
}

processDocuments().catch(err => console.error(err));
