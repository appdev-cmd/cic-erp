const fs = require('fs');
const path = require('path');

const logPath = path.join(__dirname, 'litellm_kpi.log');
if (!fs.existsSync(logPath)) {
    console.error("Không tìm thấy file log!");
    process.exit(1);
}

const content = fs.readFileSync(logPath, 'utf8');
const lines = content.split('\n');

console.log("=== KIỂM TRA TOOLS TRONG REQUEST CỦA LITELLM ===");

let currentBlock = [];
let capture = false;

for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    if (line.includes('Request to litellm:') || line.includes('POST Request Sent from LiteLLM:')) {
        currentBlock = [];
        capture = true;
    }
    
    if (capture) {
        currentBlock.push(line);
    }
    
    if (capture && (line.includes('Async Response:') || line.includes('ModelResponse(') || line.includes('POST /v1/chat/completions HTTP/1.1" 200 OK'))) {
        const blockStr = currentBlock.join('\n');
        
        // Ta tìm request mà tin nhắn cuối cùng trong messages là "Cho tôi xem KPI tổng quan công ty"
        // Điều này đại diện cho request gửi đi khi user vừa hỏi câu này.
        if (blockStr.includes('Cho tôi xem KPI tổng quan công ty')) {
            // Lọc ra các dòng chứa tools trong block này
            const linesInBlock = currentBlock;
            let hasTools = false;
            let toolsContent = '';
            
            for (const l of linesInBlock) {
                if (l.includes('tools=') || l.includes("'tools':")) {
                    hasTools = true;
                    toolsContent = l;
                    break;
                }
            }
            
            console.log(`\nFound Request with text "Cho tôi xem KPI tổng quan công ty"`);
            console.log("Has tools in payload:", hasTools);
            if (hasTools) {
                console.log("Tools parameter snippet:", toolsContent.substring(0, 500));
            } else {
                // Kiểm tra xem payload có tools ko bằng cách in ra các keys
                console.log("Snippet of request variables:");
                console.log(blockStr.substring(0, 1000));
            }
        }
        capture = false;
    }
}
