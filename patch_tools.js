const fs = require('fs');

let content = fs.readFileSync('services/ai/openclaw/tools/registry.ts', 'utf8');

// Fix content type
content = content.replace("contentType = 'text/html;charset=utf-8';", "contentType = 'text/html';");

// Fix tool description
const oldDesc = "description: 'Tạo và đóng gói file báo cáo và trả về Link Tải xuống. \\nCHỈ SỬ DỤNG KHI USER YÊU CẦU \"XUẤT RA FILE\", \"LƯU THÀNH FILE\", HOẶC \"TẢI XUỐNG\". Tuyệt đối không tự ý gọi tool này nếu user chỉ yêu cầu \"Lập báo cáo\". \\nLƯU Ý QUAN TRỌNG: \\n1. Khách hàng thường thích BÁO CÁO CỰC KỲ CHI TIẾT. Hãy viết Thuyết minh dài, phân tích sâu.\\n2. Nếu có dữ liệu số, HÃY tận dụng cú pháp markdown \` \`\`\`chart \` để nhúng biểu đồ (đặc biệt là biểu đồ doanh thu hàng tháng, so sánh, v.v..).\\n3. Nếu báo cáo ĐANG CÓ BIỂU ĐỒ, bạn **PHẢI** chọn format=html (Bắt buộc) để người dùng xem được màu sắc, tương tác.\\n4. Nếu chỉ xuất văn bản đơn thuần để in, mới dùng doc.',";
const newDesc = "description: '[\u26A0\uFE0F QUAN TRỌNG: TUYỆT ĐỐI KHÔNG DÙNG TOOL NÀY NẾU USER CHỈ NÓI \"LẬP BÁO CÁO\" HAY \"THỐNG KÊ\". CHỈ ĐƯỢC CHẠY KHI USER NÓI RÕ \"XUẤT FILE\", \"TẢI FILE\", HOẶC \"TẢI XUỐNG\"] Tạo và tải file báo cáo. \\nLƯU Ý: \\n1. Báo cáo hãy viết dài, phân tích sâu.\\n2. Hãy tận dụng markdown \` \`\`\`chart \` để nhúng biểu đồ.\\n3. Chọn format=html nếu có biểu đồ.',";
content = content.replace(oldDesc, newDesc);

// Fix jsonString parse
const oldParse = "const config = JSON.parse(jsonString);";
const newParse = `
            let cleanJson = jsonString.trim();
            if (cleanJson.startsWith('\`\`\`json')) cleanJson = cleanJson.replace(/\`\`\`json/g, '').replace(/\`\`\`/g, '').trim();
            const firstBrace = cleanJson.indexOf('{');
            const lastBrace = cleanJson.lastIndexOf('}');
            if (firstBrace !== -1 && lastBrace !== -1) {
                cleanJson = cleanJson.substring(firstBrace, lastBrace + 1);
            }
            const config = JSON.parse(cleanJson);
`;
content = content.replace(oldParse, newParse);

fs.writeFileSync('services/ai/openclaw/tools/registry.ts', content, 'utf8');
console.log('Patched');
