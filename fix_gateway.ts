import * as fs from 'fs';

let content = fs.readFileSync('services/ai/gateway.ts', 'utf8');

// 1. Ditch the buggy Gemma strip logic from callAgentTurn history mapping
const stripRegex = /\s*const isGemmaModel = request\.model\?\.toLowerCase\(\)\.includes\('gemma'\);\s*if \(isVllmOrLocal && isGemmaModel\) \{[\s\S]*?\} else \{/g;
content = content.replace(stripRegex, '    if (isVllmOrLocal) {');

// 2. We need to add extractGemmaToolCalls right before callAgentTurn
const extractCode = `
// ═══════════════════════════════════════
// AGENT TURN (Tool Calling)
// ═══════════════════════════════════════

function extractGemmaToolCalls(content: string) {
    let tool_calls: any[] = [];
    if (!content.includes('<|tool_call|>') && !content.includes('call:')) return null;

    const regex = /(?:<\\|tool_call\\|>)?\\s*call:([a-zA-Z0-9_]+)\\{([^}]*)\\}\\s*(?:<\\|\\/?tool_call\\|>|>|$)/gs;
    let match;
    let hasMatch = false;
    
    while ((match = regex.exec(content)) !== null) {
        hasMatch = true;
        const fnName = match[1];
        let rawArgs = match[2].trim();
        rawArgs = rawArgs.replace(/<\\|\\/?tool_call\\|?>.*$/s, '').trim();
        let cleanArgs = rawArgs.replace(/<\\|">/g, '"').replace(/<\\|\\/">/g, '"');
        let jsonStr = \`{\${cleanArgs}}\`.replace(/([{,]\\s*)([a-zA-Z0-9_]+)\\s*:/gs, '$1"$2":');
        
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
            console.error('[Gemma Parser] Failed to parse JSON args:', jsonStr);
        }
    }
    
    return hasMatch ? tool_calls : null;
}

/**
 * Gọi 1 turn của Agent. Trả về cả message và tool_calls (không stream).
 */
export async function callAgentTurn(request: ChatRequest): Promise<{ message?: string; tool_calls?: any[] }> {`;

content = content.replace(/\/\/ ═══════════════════════════════════════\n\/\/ AGENT TURN .*?\n\/\/ ═══════════════════════════════════════\n\n\/\*\*\n \* Gọi 1 turn/s, extractCode);

// 3. Fallback logic at the end of callAgentTurn
const fallbackCode = `
      let content = data.choices[0].message?.content || undefined;
      let tool_calls = data.choices[0].message?.tool_calls;
      
      // Fallback for Gemma-like models that output <|tool_call|> text
      if (!tool_calls || tool_calls.length === 0) {
        if (content && (content.includes('<|tool_call|>') || content.includes('call:'))) {
            const extracted = extractGemmaToolCalls(content);
            if (extracted && extracted.length > 0) {
               tool_calls = extracted;
               content = content.replace(/(?:<\\|tool_call\\|>)?\\s*call:([a-zA-Z0-9_]+)\\{([^}]*)\\}\\s*(?:<\\|\\/?tool_call\\|>|>|$)/gs, '').trim() || undefined;
            }
        }
      }

      return {
        message: content,
        tool_calls
      };`;
      
content = content.replace(/let content = data\.choices\[0\]\.message\?\.content \|\| undefined;[\s\S]*?return \{\s*message: content(?:,\s*tool_calls:\s*data.*?|\s*)\};/s, fallbackCode);

// 4. Update streamOpenAICompatible with buffering filter
const streamInnerCode = `
  let buffer = '';
  for await (const chunk of stream) {
    if (request.signal?.aborted) {
      stream.controller.abort();
      return;
    }
    const content = chunk.choices[0]?.delta?.content || '';
    if (!content) continue;
    
    buffer += content;
    
    while(buffer.length > 0) {
       const startIdx = buffer.indexOf('<|tool');
       if (startIdx === -1) {
          // No start tag found. Check for partial tags at the end.
          let matchPartial = false;
          const openTag = '<|tool_call|>';
          for (let i = 1; i <= openTag.length; i++) {
             if (buffer.endsWith(openTag.slice(0, i))) {
                matchPartial = true;
                const safePart = buffer.slice(0, buffer.length - i);
                if (safePart) yield safePart;
                buffer = buffer.slice(buffer.length - i);
                break;
             }
          }
          if (!matchPartial) {
             yield buffer;
             buffer = '';
          }
          break;
       } else {
          // Found <|tool...
          if (startIdx > 0) {
             yield buffer.slice(0, startIdx);
             buffer = buffer.slice(startIdx);
             continue; // Re-evaluate
          }
          // Buffer starts with <|tool...
          // Wait for the full block
          const closeBracket = buffer.indexOf('}>');
          const closeTag = buffer.indexOf('<|/tool_call|>');
          
          let endIdx = -1;
          if (closeTag !== -1) endIdx = closeTag + 14; // length of <|/tool_call|>
          else if (closeBracket !== -1) endIdx = closeBracket + 2;
          
          if (endIdx === -1) {
             // If buffer is getting too large and we still haven't found closing, just clear it
             if (buffer.length > 500) {
                 buffer = '';
             }
             break; // Wait for more chunks to close the tag
          }
          
          // Discard the entire block
          buffer = buffer.slice(endIdx);
       }
    }
  }
  if (buffer) yield buffer;
}
`;

content = content.replace(/for await \(const chunk of stream\) \{[\s\S]*?\}\s*\}/s, streamInnerCode);

fs.writeFileSync('services/ai/gateway.ts', content);
