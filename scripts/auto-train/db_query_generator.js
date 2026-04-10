import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import fetch from 'node-fetch';
import { createClient } from '@supabase/supabase-js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const envPath = path.resolve(__dirname, '../../.env.local');
if (fs.existsSync(envPath)) {
  const rawEnv = fs.readFileSync(envPath, 'utf8');
  rawEnv.split('\n').forEach(line => {
    const match = line.match(/^([^#\s=]+)=(.*)$/);
    if (match) process.env[match[1]] = match[2].replace(/^['"]|['"]$/g, '');
  });
}

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

const API_BASE = 'http://127.0.0.1:8000/v1';
const API_KEY = 'empty';
const TEACHER_MODEL = 'hugging-quants/Meta-Llama-3.1-70B-Instruct-AWQ-INT4';
const OUTPUT_FILE = path.join(__dirname, 'dataset/legal_training_data.jsonl');

function appendToJsonL(filePath, dataObj) {
  fs.appendFileSync(filePath, JSON.stringify(dataObj) + '\n');
}

async function generateNaturalQueriesForRecord(tableName, record) {
    const systemPrompt = `Bạn là Chuyên gia mô phỏng Dữ liệu Nhân sự (CIC ERP).
Tôi sẽ cung cấp cho bạn một bản ghi (JSON record) từ Database (bảng ${tableName}).
Nhiệm vụ của bạn: Đóng vai Đội ngũ nhân viên, Giám đốc, Kế toán... và suy nghĩ ra 2 câu hỏi TỰ NHIÊN NHẤT mà người dùng đời thực sẽ gõ vào Chatbot để hỏi thăm thông tin chứa trong bản ghi này.
Sau đó đóng vai Chatbot để trả lời ngắn gọn, móc trích chính xác data đó ra.

Luật bắt buộc: 
1. Trả về đúng JSON Array chứa: { "q": "câu hỏi của user", "a": "câu trả lời của trợ lý" }
2. KHÔNG giải thích, KHÔNG markdown.`;

    try {
        const response = await fetch(`${API_BASE}/chat/completions`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${API_KEY}`
            },
            body: JSON.stringify({
                model: TEACHER_MODEL,
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: `BẢN GHI DỮ LIỆU:\n${JSON.stringify(record, null, 2)}` }
                ],
                temperature: 0.7,
                max_tokens: 3000
            }),
            signal: AbortSignal.timeout(300000)
        });

        const data = await response.json();
        if (data.error) throw new Error(data.error.message);

        let content = data.choices[0].message.content.trim();
        if (content.startsWith('```json')) content = content.replace(/^```json/, '');
        if (content.startsWith('```')) content = content.replace(/^```/, '');
        if (content.endsWith('```')) content = content.replace(/```$/, '');
        content = content.trim();

        return JSON.parse(content);
    } catch (e) {
        console.error("Lỗi khi sinh Q&A từ DB Record:", e.message);
        return [];
    }
}

async function run() {
    console.log("🚀 KÍCH HOẠT HỆ THỐNG MỘ THỎNG TRUY VẤN - ERP DATABASE");
    if (!supabaseUrl || !supabaseKey) {
        console.log("⚠️ Không tìm thấy kết nối Supabase, quá trình này bị hủy.");
        return;
    }

    const supabase = createClient(supabaseUrl, supabaseKey);
    
    console.log("-> Đang cào ngẫu nhiên Dữ liệu Từ Đa Dạng Bảng (Contracts, Candidates, Customers, Employees, Products, Projects)...");
    const tablesToMock = [
        { name: 'contracts', query: supabase.from('contracts').select('contract_number, name, value, status, signed_date, customer_id').limit(10) },
        { name: 'candidates', query: supabase.from('candidates').select('full_name, email, position, status, expected_salary').limit(10) },
        { name: 'customers', query: supabase.from('customers').select('name, short_name, industry, tax_code, email, phone').limit(10) },
        { name: 'employees', query: supabase.from('employees').select('name, employee_code, email, position, department').limit(10) },
        { name: 'products', query: supabase.from('products').select('code, name, category, base_price, unit').limit(10) },
        { name: 'projects', query: supabase.from('projects').select('code, name, status, location, progress, client_name').limit(10) },
        { name: 'tasks', query: supabase.from('tasks').select('title, status_id, priority, start_date, due_date').limit(10) },
        { name: 'payments', query: supabase.from('payments').select('amount, paid_amount, status, payment_date, notes').limit(10) }
    ];

    for (const t of tablesToMock) {
        const { data, error } = await t.query;
        if (error) {
            console.error(`Lỗi lấy data bảng ${t.name}:`, error.message);
            continue;
        }

        console.log(`Tiến hành mô phỏng hội thoại cho ${data.length} records của ${t.name}...`);
        for (const record of data) {
            const pairs = await generateNaturalQueriesForRecord(t.name, record);
            if (pairs && pairs.length > 0) {
                pairs.forEach(p => {
                    appendToJsonL(OUTPUT_FILE, {
                        messages: [
                            { role: "system", content: "Bạn là trợ lý ảo giải đáp Dữ liệu nội bộ ERP CIC." },
                            { role: "user", content: p.q },
                            { role: "assistant", content: p.a }
                        ]
                    });
                });
                console.log(`Đã xuất 2 Q&A tổng hợp cho bản ghi: ${record.name || record.full_name}`);
            }
        }
    }
    console.log("🎉 XONG! Dữ liệu DB đã được bơm thành công vào Jsonl.");
}

run();
