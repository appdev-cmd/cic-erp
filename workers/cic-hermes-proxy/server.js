const express = require('express');
const cors = require('cors');
const { spawn } = require('child_process');

const app = express();
app.use(cors());
app.use(express.json());

const PORT = 3005;

app.post('/api/chat', (req, res) => {
  const { message, agentId, userId, history, userContext } = req.body;
  if (!message) {
    return res.status(400).json({ error: 'Message is required' });
  }

  // Choose persona from agentId (e.g. 'BGD' -> 'bgd')
  let persona = 'bgd';
  if (agentId && typeof agentId === 'string') {
    persona = agentId.toLowerCase();
  }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  const sessionName = `web_${userId || 'default'}`;

  // Build Contextual Data
  const todayStr = new Date().toISOString().slice(0, 10);
  let userName = userContext?.fullName || 'Người dùng';
  let userRole = userContext?.role || 'NVKD';
  let userUnit = userContext?.unitName || userContext?.unitCode || 'N/A';

  let prompt = `[LƯU Ý QUẢN TRỊ VIÊN: BẠN PHẢI SỬ DỤNG NHÂN CÁCH TRỢ LÝ: ${persona.toUpperCase()}]\n`;
  prompt += `[THÔNG TIN NGƯỜI DÙNG ĐANG CHAT: Tên: ${userName}, Chức vụ: ${userRole}, Đơn vị: ${userUnit}]\n`;
  prompt += `[THỜI GIAN THỰC TẾ HÔM NAY: ${todayStr}]\n\n`;

  // Build conversational transcript from history
  if (history && Array.isArray(history) && history.length > 0) {
    prompt += `[DƯỚI ĐÂY LÀ LỊCH SỬ CUỘC TRÒ CHUYỆN (CONTEXT). HÃY LẤY ĐÓ LÀM NGỮ CẢNH: ]\n`;
    history.forEach(m => {
      if (m.content) {
        prompt += `${m.role === 'model' ? '[AI TRẢ LỜI TRƯỚC ĐÓ]' : '[NGƯỜI DÙNG HỎI TRƯỚC ĐÓ]'}: ${m.content}\n\n`;
      }
    });
    prompt += `[KẾT THÚC LỊCH SỬ. DƯỚI ĐÂY LÀ CÂU HỎI MỚI NHẤT CỦA NGƯỜI DÙNG ĐỂ BẠN TRẢ LỜI:]\n`;
  }

  prompt += `Người dùng hỏi: ${message}`;

  const child = spawn('hermes', ['chat', '-Q', '-q', prompt], { timeout: 180000 });

  let finalOutput = '';

  child.stdout.on('data', (data) => {
    finalOutput += data.toString();
  });

  child.stderr.on('data', (data) => {
    console.error(`[HERMES STDERR]: ${data}`);
  });

  child.on('close', (code) => {
    console.log(`Hermes process exited with code ${code}`);
    
    // Clean Output
    let lines = finalOutput.split(/\r?\n/);
    
    // Filter out MCP server running text, Hermes box borders, and session_id
    lines = lines.filter(line => {
        if (line.includes('CIC ERP MCP Server is running')) return false;
        if (line.match(/^╭─ .*Hermes.* ─*╮$/)) return false;
        if (line.match(/^╰─*╯$/)) return false;
        if (line.startsWith('session_id:')) return false;
        return true;
    });

    let cleanText = lines.join('\n').trim();

    let i = 0;
    const sendChunk = () => {
        if (i < cleanText.length) {
            const chunk = cleanText.substring(i, i + 10);
            res.write(`data: ${JSON.stringify({ text: chunk })}\n\n`);
            i += 10;
            setTimeout(sendChunk, 10);
        } else {
            res.write('data: [DONE]\n\n');
            res.end();
        }
    };
    sendChunk();
  });
});

app.listen(PORT, () => {
  console.log(`Hermes Proxy Server running on port ${PORT}`);
});
