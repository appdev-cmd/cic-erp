import { callAgentTurn } from './services/ai/gateway.ts';

async function test() {
    try {
        console.log("Calling deepseek...");
        const res = await callAgentTurn({
            model: 'deepseek-chat',
            messages: [{ role: 'user', content: 'test' }]
        });
        console.log("Success:", res);
    } catch (err) {
        console.log("Error caught:", err.message);
    }
}
test();
