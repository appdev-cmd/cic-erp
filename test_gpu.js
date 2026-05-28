async function test() {
    const url = 'https://ai-api.cic.com.vn:9443/v1/chat/completions';
    const key = 'sk-cic-2026';
    
    console.log(`Connecting to chat completions: ${url}`);
    const payload = {
        model: 'gemma-4-26b',
        messages: [{ role: 'user', content: 'Xin chào, bạn tên là gì?' }],
        temperature: 0.7,
        stream: false
    };

    try {
        const startTime = Date.now();
        const res = await fetch(url, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${key}`,
                'Content-Type': 'application/json',
                'ngrok-skip-browser-warning': 'true'
            },
            body: JSON.stringify(payload)
        });
        
        console.log(`Response Status: ${res.status}`);
        console.log(`Time taken: ${Date.now() - startTime}ms`);
        const text = await res.text();
        console.log(`Response Text (first 1000 chars):`);
        console.log(text.substring(0, 1000));
    } catch (err) {
        console.error("Connection Error:", err);
    }
}

test();
