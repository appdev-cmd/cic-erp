function extractGemmaToolCalls(content: string) {
    let tool_calls: any[] = [];
    if (!content.includes('<|tool_call|>')) {
        console.log("No <|tool_call|>");
        return null;
    }

    const regex = /<\|tool_call\|>(.*?)(<\|\/?tool_call\|>|$)/g;
    let match;
    while ((match = regex.exec(content)) !== null) {
        let rawContent = match[1].trim();
        rawContent = rawContent.replace(/<\|">/g, '"').replace(/<\|\/">/g, '"');
        console.log("rawContent:", rawContent);
        
        const callMatch = rawContent.match(/^call:([a-zA-Z0-9_]+)\{(.*)\}$/);
        if (callMatch) {
            const fnName = callMatch[1];
            let rawArgs = callMatch[2];
            let jsonStr = `{${rawArgs}}`.replace(/([{,]\s*)([a-zA-Z0-9_]+)\s*:/g, '$1"$2":');
            console.log("jsonStr:", jsonStr);
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

const c = '<|tool_call|>call:get_comprehensive_report{year:<|">2025<|">}<|tool_call|>';
const ext = extractGemmaToolCalls(c);
console.log("Extracted:", ext);
if (ext) {
    const textReplaced = c.replace(/<\|tool_call\|>.*?(<\|\/?tool_call\|>|$)/g, '').trim();
    console.log("Cleaned:", textReplaced, "length:", textReplaced.length);
}
