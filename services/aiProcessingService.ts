/**
 * AI Processing Service — CIC ERP
 * 
 * Cung cấp các tiện ích AI sử dụng Gemini 2.0 Flash (vision, text generation):
 * 1. OCR: Trích xuất text từ ảnh (PNG, JPG)
 * 2. Auto-tagging: Gọi AI tự động sinh tags từ nội dung
 */

/**
 * Trợ thủ đổi File thành Base64
 */
function fileToBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => {
            const result = reader.result as string;
            // Xóa tiền tố data:image/png;base64,
            const base64Data = result.split(',')[1];
            resolve(base64Data);
        };
        reader.onerror = error => reject(error);
    });
}

/**
 * Lấy API Key từ localStorage (đã config ở EmbeddingSettings)
 */
function getGeminiKey(): string {
    if (typeof window !== 'undefined') {
        const key = localStorage.getItem('cic-gemini-api-key');
        return key || '';
    }
    return '';
}

/**
 * Trích xuất văn bản từ hình ảnh (OCR) sử dụng Gemini 2.0 Flash
 */
export async function extractTextFromImageAsOCR(file: File): Promise<string> {
    const apiKey = getGeminiKey();
    if (!apiKey) {
        throw new Error('Cần cấu hình Gemini API Key trong Cài đặt (AI API) để sử dụng tính năng OCR trích xuất ảnh.');
    }

    const mimeType = file.type;
    const base64Data = await fileToBase64(file);

    const payload = {
        contents: [
            {
                parts: [
                    { text: "Trích xuất toàn bộ văn bản trong hình ảnh này một cách chính xác nhất. Nếu là tiếng Việt thì giữ nguyên tiếng Việt. Chỉ trả về văn bản được trích xuất, không thêm lời bình." },
                    {
                        inline_data: {
                            mime_type: mimeType,
                            data: base64Data
                        }
                    }
                ]
            }
        ],
        generationConfig: {
            temperature: 0.1, // Cần độ chính xác cao cho OCR
            maxOutputTokens: 2048,
        }
    };

    const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent?key=${apiKey}`,
        {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        }
    );

    if (!response.ok) {
        const errObj = await response.json();
        throw new Error(`OCR thất bại: ${errObj.error?.message || response.statusText}`);
    }

    const data = await response.json();
    const textOutput = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    
    if (!textOutput) {
        throw new Error('OCR không trả về nội dung.');
    }

    return textOutput.trim();
}

/**
 * Tự động gắn thẻ (Auto-tagging) từ một đoạn nội dung
 * Truyền vào khoảng 1000 - 2000 ký tự đầu tiên để lấy keywords
 */
export async function suggestTagsForContent(text: string): Promise<string[]> {
    const apiKey = getGeminiKey();
    if (!apiKey) {
        return []; // Không ném lỗi để tránh crash pipeline, chỉ trả về mảng rỗng nếu không có key
    }

    const sampleText = text.substring(0, 1500); // Lấy 1500 char để sinh tags

    const payload = {
        contents: [
            {
                parts: [
                    { text: `Đọc đoạn văn bản sau và trích xuất ra 3 đến 5 thẻ (tags/keywords) ngắn gọn bằng tiếng Việt, giúp phân loại tài liệu này.\nCầu trúc trả về là một chuỗi phân tách bằng dấu phẩy, ví dụ: Hợp đồng, Báo cáo tài chính, 2026. KHÔNG trả về các text nào khác.\n\nVăn bản: "${sampleText}"` }
                ]
            }
        ],
        generationConfig: {
            temperature: 0.3,
            maxOutputTokens: 50,
        }
    };

    try {
        const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent?key=${apiKey}`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            }
        );

        if (!response.ok) {
            return []; // Fail silently
        }

        const data = await response.json();
        const textOutput = data?.candidates?.[0]?.content?.parts?.[0]?.text;
        
        if (!textOutput) return [];

        // Parse: "Hợp đồng, Kế toán, Nội bộ" -> ["Hợp đồng", "Kế toán", "Nội bộ"]
        const tags = textOutput.split(',')
            .map((t: string) => t.trim().replace(/^['"-]+|['"-]+$/g, '')) // clear quotes/dashes
            .filter((t: string) => t.length > 0 && t.length < 25); // Tag quá dài thì bỏ qua
            
        return tags;
    } catch (err) {
        console.warn("Auto-tagging failed:", err);
        return [];
    }
}
