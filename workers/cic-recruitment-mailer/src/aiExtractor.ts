import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const pdfParse = require('pdf-parse');

import { config } from './config.js';

export async function parsePdfToText(buffer: Buffer): Promise<string> {
  const data = await pdfParse(buffer);
  return data.text;
}

export async function extractCandidateFromJson(text: string): Promise<any> {
  const prompt = `Từ nội dung CV sau, hãy trích xuất dưới định dạng JSON gốc KHÔNG MARKDOWN gồm các trường:
{
  "full_name": "Tên ứng viên",
  "email": "Email",
  "phone": "Số điện thoại",
  "education": "Đại học/Trường...",
  "experience_years": số bằng số thập phân (vd: 2.5),
  "skills": ["kỹ năng 1", "kỹ năng 2"],
  "notes": "Đánh giá tóm tắt năng lực"
}
Nội dung CV:
${text.substring(0, 3000)}
`;

  try {
    const res = await fetch(`${config.ollama.host}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: config.ollama.model,
        prompt: prompt,
        format: "json",
        stream: false
      })
    });
    
    if (!res.ok) throw new Error("Ollama generation failed");
    const data = await res.json();
    return JSON.parse(data.response);
  } catch (err) {
    console.error("Ollama Extraction Error:", err);
    return {};
  }
}
