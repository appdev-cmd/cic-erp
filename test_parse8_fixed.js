import fs from 'fs';

const gatewayCode = fs.readFileSync('/home/cic-ai/cic-project/cic-erp/services/ai/gateway.ts', 'utf-8');

// Trích xuất extractGemmaToolCalls function from string
const extractFnMatch = gatewayCode.match(/function extractGemmaToolCalls.*?return tool_calls\.length > 0 \? tool_calls : null;\n\}/s);
if (extractFnMatch) {
    const fnCode = extractFnMatch[0];
    const testCode = fnCode + `\n
const content1 = "<|tool_call|>call:get_debt_report{sortBy:<|\\">amount<|\\">}<|tool_call|>";
console.log("Test 1:", extractGemmaToolCalls(content1));
const content2 = "<|tool_call|>\\ncall:get_com综合hrensive_report{year:<|\\">2025<|\\">}\\n<|tool_call|>";
console.log("Test 2:", extractGemmaToolCalls(content2));
`;
    fs.writeFileSync('test_run.js', testCode);
} else {
    console.log("Could not find extractGemmaToolCalls function");
}
