import { NATIVE_TOOLS_SCHEMA } from './src/agent/erpReactAgent.js';

(async () => {
    const res = await fetch("http://127.0.0.1:4000/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": "Bearer sk-cic-2026" },
        body: JSON.stringify({
            model: "gemma-4-26b",
            messages: [{ "role": "user", "content": "alo" }],
            tools: NATIVE_TOOLS_SCHEMA
        })
    });
    console.log(res.status, await res.text());
})();
