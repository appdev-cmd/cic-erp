import fetch from 'node-fetch';

async function test() {
    const url = 'https://ai-api.cic.com.vn:9443/v1/embeddings';
    const models = ['nomic-embed-text', 'gemma-4-26b', 'qwen2.5-vl-7b'];

    for (const model of models) {
        console.log(`Testing embedding with model: ${model}`);
        try {
            const res = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': 'Bearer sk-cic-2026'
                },
                body: JSON.stringify({
                    model: model,
                    input: 'Kiểm tra kết nối embedding CIC ERP'
                })
            });

            console.log(`Status: ${res.status} ${res.statusText}`);
            const body = await res.text();
            console.log(`Response: ${body.substring(0, 500)}\n`);
        } catch (e: any) {
            console.error(`Error: ${e.message}\n`);
        }
    }
}

test();
