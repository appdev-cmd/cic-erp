let content = '<|tool_call|>call:get_debt_report{sortBy:<|">amount<|">}<|tool_call|>';
let cleaned = content.replace(/<\|tool_call\|>.*?(<\|\/?tool_call\|>|$)/gs, '').trim();
console.log("Cleaned length:", cleaned.length, "Cleaned:", cleaned);
