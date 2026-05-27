import fetch from 'node-fetch'; // Or just native fetch since Node 18+ has it.

async function testModel(modelName: string) {
  console.log(`--- Testing model: ${modelName} ---`);
  try {
    const res = await fetch('https://ai-api.cic.com.vn:9443/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer sk-cic-2026'
      },
      body: JSON.stringify({
        model: modelName,
        messages: [{ role: 'user', content: 'Xin chào' }],
        max_tokens: 20,
        temperature: 0.1
      })
    });

    console.log(`Status: ${res.status}`);
    const data = await res.text();
    console.log(`Response: ${data}`);
  } catch (err: any) {
    console.error(`Error: ${err.message}`);
  }
}

async function run() {
  await testModel('gemma-4-26b');
  await testModel('qwen2.5-vl-7b');
}

run();
