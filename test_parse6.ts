function extractGemmaToolCalls(content: string) {
    let tool_calls: any[] = [];
    if (!content.includes('<|tool_call|>')) return null;

    const regex = /<\|tool_call\|>(.*?)(<\|\/?tool_call\|>|$)/gs;
    let match;
    while ((match = regex.exec(content)) !== null) {
        let rawContent = match[1].trim();
        rawContent = rawContent.replace(/<\|">/g, '"').replace(/<\|\/">/g, '"');
        console.log("Raw:", rawContent);
        
        // 1. Format: call:function_name{args...}
        const callMatch = rawContent.match(/^call:([a-zA-Z0-9_]+)\{(.*)\}$/s);
        if (callMatch) {
            const fnName = callMatch[1];
            let rawArgs = callMatch[2];
            let jsonStr = `{${rawArgs}}`.replace(/([{,]\s*)([a-zA-Z0-9_]+)\s*:/gs, '$1"$2":');
            console.log("JSON:", jsonStr);
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
        
    }
    
    return tool_calls.length > 0 ? tool_calls : null;
}
console.log(extractGemmaToolCalls("<|tool_call|>call:search_knowledge_base{query:<|\">BIM là gì<|\">}<|tool_call|>"));
