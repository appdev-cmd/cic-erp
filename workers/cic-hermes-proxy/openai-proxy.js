const express = require('express');
const cors = require('cors');

const app = express();
app.use(cors());
// Need raw body or parsing to forward
app.use(express.json({ limit: '10mb' }));

const UPSTREAM_URL = 'http://localhost:8001/v1';

function extractGemmaToolCalls(content) {
    let tool_calls = [];
    if (!content.includes('<|tool_call|>') && !content.includes('call:')) return null;

    content = content.replace(/<<\|tool_call\|>/g, '<|tool_call|>');
    
    // Balanced brace matching for nested JSON
    const callPattern = /(?:<\|tool_call\|>)?\s*call:([a-zA-Z0-9_]+)\{/g;
    let match;
    let hasMatch = false;
    let cleaned_content = content;
    const toRemove = [];
    
    while ((match = callPattern.exec(content)) !== null) {
        hasMatch = true;
        const fnName = match[1];
        const braceStart = match.index + match[0].length - 1;
        
        let depth = 0;
        let end = braceStart;
        for (let i = braceStart; i < content.length; i++) {
          if (content[i] === '{') depth++;
          else if (content[i] === '}') {
            depth--;
            if (depth === 0) { end = i; break; }
          }
        }
        
        const fullMatchStr = content.substring(match.index, end + 1);
        toRemove.push(fullMatchStr);
        
        let rawJson = content.substring(braceStart, end + 1);
        rawJson = rawJson.replace(/<\|\/?tool_call\|?>/g, '').replace(/<\/?tool_call\|?>/g, '');
        
        rawJson = rawJson.replace(/<\|(?:\"|\')\|?>([\s\S]*?)<\|(?:\"|\')\|?>/g, (match, innerString) => {
            const escaped = innerString
                .replace(/\\/g, '\\\\')
                .replace(/\n/g, '\\n')
                .replace(/\r/g, '\\r')
                .replace(/"/g, '\\"')
                .replace(/\t/g, '\\t');
            return '"' + escaped + '"';
        });

        rawJson = rawJson.replace(/<\|"\|?>/g, '"').replace(/<\|'\|?>/g, "'");
        
        let jsonStr = rawJson.replace(/([{,]\s*)([a-zA-Z0-9_]+)\s*:/gs, '$1"$2":');
        jsonStr = jsonStr.replace(/:\s*'([^']*)'/g, ':"$1"');
        
        try {
            const argsObj = JSON.parse(jsonStr);
            tool_calls.push({
                id: 'call_' + Math.random().toString(36).substr(2, 9),
                type: 'function',
                function: {
                    name: fnName,
                    arguments: JSON.stringify(argsObj)
                }
            });
        } catch (e) {
            console.error('[OpenAI Proxy] Parse err:', jsonStr.substring(0, 100));
        }
    }
    
    if (!hasMatch) return null;
    
    for (const rm of toRemove) {
        cleaned_content = cleaned_content.replace(rm, '');
    }
    cleaned_content = cleaned_content.replace(/<\|\/?tool_call\|?>/g, '').trim();
    cleaned_content = cleaned_content.replace(/<\/?tool_call\|?>/g, '').trim();
    
    return { tool_calls, cleaned_content };
}

app.post('/v1/chat/completions', async (req, res) => {
    try {
        const clientRequestedStream = req.body.stream === true;
        req.body.stream = false; // Always force vLLM to return a full object

        const fetchRes = await fetch(`${UPSTREAM_URL}/chat/completions`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(req.body)
        });

        if (!fetchRes.ok) {
            const errorText = await fetchRes.text();
            res.status(fetchRes.status).send(errorText);
            return;
        }

        const data = await fetchRes.json();
        
        // Parse Gemma output
        if (data.choices && data.choices[0] && data.choices[0].message) {
            let content = data.choices[0].message.content || '';
            let tool_calls = data.choices[0].message.tool_calls;
            
            if (!tool_calls || tool_calls.length === 0) {
                if (content.includes('<|tool_call|>') || content.includes('call:')) {
                    const extracted = extractGemmaToolCalls(content);
                    if (extracted && extracted.tool_calls.length > 0) {
                        data.choices[0].message.tool_calls = extracted.tool_calls;
                        data.choices[0].message.content = extracted.cleaned_content || null;
                        data.choices[0].finish_reason = 'tool_calls';
                    }
                }
            }
        }

        if (clientRequestedStream) {
            res.setHeader('Content-Type', 'text/event-stream');
            res.setHeader('Cache-Control', 'no-cache');
            res.setHeader('Connection', 'keep-alive');

            const choice = data.choices[0];
            const message = choice.message;

            // Send role chunk
            const firstChunk = {
                id: data.id,
                object: "chat.completion.chunk",
                created: data.created,
                model: data.model,
                choices: [{
                    index: 0,
                    delta: { role: "assistant" },
                    finish_reason: null
                }]
            };
            res.write(`data: ${JSON.stringify(firstChunk)}\n\n`);

            // Send tool calls if any
            if (message.tool_calls && message.tool_calls.length > 0) {
                const toolChunk = {
                    id: data.id,
                    object: "chat.completion.chunk",
                    created: data.created,
                    model: data.model,
                    choices: [{
                        index: 0,
                        delta: { tool_calls: message.tool_calls.map((tc, idx) => ({
                            index: idx,
                            id: tc.id,
                            type: tc.type,
                            function: tc.function
                        })) },
                        finish_reason: null
                    }]
                };
                res.write(`data: ${JSON.stringify(toolChunk)}\n\n`);
            }

            // Send content if any
            if (message.content) {
                const contentChunk = {
                    id: data.id,
                    object: "chat.completion.chunk",
                    created: data.created,
                    model: data.model,
                    choices: [{
                        index: 0,
                        delta: { content: message.content },
                        finish_reason: null
                    }]
                };
                res.write(`data: ${JSON.stringify(contentChunk)}\n\n`);
            }

            // Send finish chunk
            const finishChunk = {
                id: data.id,
                object: "chat.completion.chunk",
                created: data.created,
                model: data.model,
                choices: [{
                    index: 0,
                    delta: {},
                    finish_reason: choice.finish_reason || "stop"
                }]
            };
            res.write(`data: ${JSON.stringify(finishChunk)}\n\n`);
            res.write(`data: [DONE]\n\n`);
            res.end();
            return;
        }

        res.json(data);
    } catch (err) {
        console.error('Error proxying chat:', err);
        res.status(500).json({ error: err.message });
    }
});

// Proxy everything else directly
app.use(async (req, res) => {
    try {
        const fetchRes = await fetch(`${UPSTREAM_URL}${req.originalUrl}`, {
            method: req.method,
            headers: { ...req.headers, host: new URL(UPSTREAM_URL).host },
            body: ['GET', 'HEAD'].includes(req.method) ? undefined : JSON.stringify(req.body)
        });
        const contentType = fetchRes.headers.get('content-type');
        if (contentType) res.setHeader('content-type', contentType);
        res.status(fetchRes.status);
        const data = await fetchRes.arrayBuffer();
        res.send(Buffer.from(data));
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.listen(8002, () => {
    console.log('OpenAI Tool-Interceptor Proxy running on port 8002');
});
