const content = `<|tool_call|>call:get_debt_report{sortBy:<|">amount<|">}<|tool_call|>`;

function testParse() {
    let rawContent = content;
    // simulating regex:
    const regex = /<\|tool_call\|>(.*?)(<\|\/?tool_call\|>|$)/gs;
    let match;
    while ((match = regex.exec(content)) !== null) {
        let rc = match[1].trim();
        rc = rc.replace(/<\|">/g, '"').replace(/<\|\/">/g, '"');
        console.log("rc:", rc);
        const callMatch = rc.match(/^call:([a-zA-Z0-9_]+)\{(.*)\}$/); // NO s flag!
        console.log("callMatch matches?", !!callMatch);
        if (callMatch) {
            console.log("callMatch[2]:", callMatch[2]);
            let jsonStr = `{${callMatch[2]}}`.replace(/([{,]\s*)([a-zA-Z0-9_]+)\s*:/g, '$1"$2":');
            console.log("jsonStr:", jsonStr);
            try {
                let parsed = JSON.parse(jsonStr);
                console.log("parsed:", parsed);
            } catch (e) {
                console.log("error parsing json");
            }
        }
    }
}
testParse();
