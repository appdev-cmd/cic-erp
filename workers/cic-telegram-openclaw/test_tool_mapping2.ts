import { erpToolsRegistry } from '../../services/ai/openclaw/tools/registry.js';
import { agentDefinitions } from '../../services/ai/openclaw/agents/definitions.js';

const agent = agentDefinitions['BGD'];
const allowedTools = new Set(agent.allowedTools);

console.log("Allowed tools count:", allowedTools.size);
console.log("Total registry tools:", erpToolsRegistry.length);

const mappedSchema = erpToolsRegistry
  .filter(tool => allowedTools.has(tool.name))
  .map(tool => {
    return {
      type: 'function',
      function: {
        name: tool.name,
        description: tool.description,
        parameters: {
          type: 'object',
          properties: tool.schema || {},
        }
      }
    };
  });

console.log("Mapped schema successfully! Found:", mappedSchema.length);
console.log("FIRST TOOL:", JSON.stringify(mappedSchema[0], null, 2));

