const content = `<|tool_call|>call:get_overdue_contracts{}<|tool_call|>`;

function testParse() {
    let rawContent = content;
    // simulating regex:
    const regex = /<\|tool_call\|>(.*?)(<\|\/?tool_call\|>|$)/gs;
    let match = regex.exec(content);
    if (!match) { console.log("Not matched"); return; }
    let rc = match[1].trim();
    rc = rc.replace(/<\|">/g, '"').replace(/<\|\/">/g, '"');
    console.log("rc:", rc);
    const callMatch = rc.match(/^call:([a-zA-Z0-9_]+)\{(.*)\}$/s); 
    if (callMatch) {
            let rawArgs = callMatch[2];
            console.log("rawArgs:", `'${rawArgs}'`);
            let jsonStr = `{${rawArgs}}`.replace(/([{,]\s*)([a-zA-Z0-9_]+)\s*:/gs, '$1"$2":');
            console.log("jsonStr:", jsonStr);
            try {
                let parsed = JSON.parse(jsonStr);
                console.log("parsed:", parsed);
            } catch (e) {
                console.log("error parsing json");
            }
    }
}
testParse();
