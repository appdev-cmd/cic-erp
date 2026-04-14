const express = require('express');
const cors = require('cors');
const { spawn } = require('child_process');

const app = express();
app.use(cors());
app.use(express.json());

const PORT = 3005;

app.post('/api/chat', (req, res) => {
  const { message, agentId, userId } = req.body;
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

  const prompt = `[LƯU Ý QUẢN TRỊ VIÊN: BẠN PHẢI SỬ DỤNG NHÂN CÁCH TRỢ LÝ: ${persona.toUpperCase()}]\n\nNgười dùng ID ${userId} hỏi: ${message}`;

  const child = spawn('hermes', ['chat', '-Q', '-q', prompt]);

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
