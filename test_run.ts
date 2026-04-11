function extractGemmaToolCalls(content: string) {
    let tool_calls: any[] = [];
    if (!content.includes('<|tool_call|>')) return null;

    // Handle both <|/tool_call|> and mistakenly generated <|tool_call|> or <|tool_call| as closing 
    const regex = /<\|tool_call\|>(.*?)(<\|\/?tool_call\|>|$)/gs;
    let match;
    while ((match = regex.exec(content)) !== null) {
        let rawContent = match[1].trim();
        rawContent = rawContent.replace(/<\|">/g, '"').replace(/<\|\/">/g, '"');
        
        // 1. Format: call:function_name{args...}
        const callMatch = rawContent.match(/^call:([a-zA-Z0-9_]+)\{(.*)\}$/s);
        if (callMatch) {
            const fnName = callMatch[1];
            let rawArgs = callMatch[2];
            let jsonStr = `{${rawArgs}}`.replace(/([{,]\s*)([a-zA-Z0-9_]+)\s*:/gs, '$1"$2":');
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
                console.warn("Failed to parse args:", jsonStr);
            }
        }
        
        // 2. Format JSON
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
        } catch(e) {}
    }
    
    return tool_calls.length > 0 ? tool_calls : null;
}

const content1 = "<|tool_call|>call:get_debt_report{sortBy:<|\">amount<|\">}<|tool_call|>";
console.log("Test 1:", extractGemmaToolCalls(content1));
const content2 = "<|tool_call|>\ncall:get_com综合hrensive_report{year:<|\">2025<|\">}\n<|tool_call|>";
console.log("Test 2:", extractGemmaToolCalls(content2));
