function extractGemmaToolCalls(content: string) {
    let tool_calls = [];
    if (!content.includes('<|tool_call|>')) return null;

    const regex = /<\|tool_call\|>(.*?)(\<\|\/tool_call\|\>|$)/g;
    let match;
    while ((match = regex.exec(content)) !== null) {
        let rawContent = match[1].trim();
        // Xóa rác <|">
        rawContent = rawContent.replace(/<\|">/g, '"').replace(/<\|\/">/g, '"');
        
        // 1. Format: call:function_name{args...}
        const callMatch = rawContent.match(/^call:([a-zA-Z0-9_]+)\{(.*)\}$/);
        if (callMatch) {
            const fnName = callMatch[1];
            let rawArgs = callMatch[2];
            // Fix unquoted keys
            let jsonStr = `{${rawArgs}}`.replace(/([{,]\s*)([a-zA-Z0-9_]+)\s*:/g, '$1"$2":');
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
                continue;
            } catch (e) {
                console.log("Failed to parse args:", jsonStr);
            }
        }
        
        // 2. Format JSON mảng: {"name": "func", "arguments": {...}}
        try {
            const parsed = JSON.parse(rawContent);
            if (Array.isArray(parsed)) {
                for (let p of parsed) {
                    if (p.name) {
                        tool_calls.push({
                            id: 'call_' + Math.random().toString(36).substr(2, 9),
                            type: 'function',
                            function: {
                                name: p.name,
                                arguments: typeof p.arguments === 'string' ? p.arguments : JSON.stringify(p.arguments || {})
                            }
                        });
                    }
                }
            } else if (parsed.name) {
               tool_calls.push({
                   id: 'call_' + Math.random().toString(36).substr(2, 9),
                   type: 'function',
                   function: {
                       name: parsed.name,
                       arguments: typeof parsed.arguments === 'string' ? parsed.arguments : JSON.stringify(parsed.arguments || {})
                   }
               });
            }
            continue;
        } catch(e) {}
    }
    
    return tool_calls.length > 0 ? tool_calls : null;
}

const c1 = `<|tool_call|>call:search_contracts{dateFrom:<|">2026-04-01<|">,dateTo:<|">2026-04-30<|">,status:<|">All<|">}<|/tool_call|>`;
console.log(extractGemmaToolCalls(c1));

const c2 = `<|tool_call|>{"name":"get_budget", "arguments":{"year":2026}}<|/tool_call|>`;
console.log(extractGemmaToolCalls(c2));

const c3 = `Blabla <|tool_call|>[{"name":"get_budget", "arguments":{"year":2026}}]`;
console.log(extractGemmaToolCalls(c3));
