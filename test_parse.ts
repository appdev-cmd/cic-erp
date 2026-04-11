const content = `<|tool_call|>call:search_contracts{dateFrom:<|">2026-04-01<|">,dateTo:<|">2026-04-30<|">,status:<|">All<|">}<|tool_call|>`;

// cleaning up the raw tokens
let clean = content.replace(/<\|">/g, '"').replace(/<\|tool_call\|>/g, '');
console.log(clean);

const match = clean.match(/call:([a-zA-Z0-9_]+)\{(.*)\}/);
if (match) {
    const fnName = match[1];
    let rawArgs = match[2];
    console.log(fnName, rawArgs);
    
    // We can parse the json if we wrap it in {}
    let jsonStr = `{${rawArgs}}`;
    // but the args are `key:"val",key:"val"`. It's not valid JSON without quotes on keys!
    // Let's use regex to quote the keys
    jsonStr = jsonStr.replace(/([a-zA-Z0-9_]+):/g, '"$1":');
    console.log("JSON STR", jsonStr);
    console.log(JSON.parse(jsonStr));
}
