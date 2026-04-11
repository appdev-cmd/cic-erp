import { callAgentTurn } from './services/ai/gateway';
import { erpToolsRegistry } from './services/ai/openclaw/tools/registry';

async function testAgent() {
  const request = {
    messages: [
      { role: 'user', content: 'Có hợp đồng nào nợ quá hạn không?' }
    ],
    model: 'gemma-4-26b',
    tools: erpToolsRegistry.map((t) => ({
      type: 'function',
      function: {
        name: t.name,
        description: t.description,
        parameters: { type: 'object', properties: t.schema },
      },
    })),
    meta: { source: 'test' }
  };
  
  try {
     const turn = await callAgentTurn(request as any);
     console.log("TURN RESULT:", turn);
  } catch(e) {
     console.log("ERROR:", e);
  }
}
testAgent();
