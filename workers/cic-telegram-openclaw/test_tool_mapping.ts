import { toolsRegistry } from '../../services/ai/openclaw/tools/registry.js';
import { agentDefinitions } from '../../services/ai/openclaw/agents/definitions.js';

const agent = agentDefinitions['BGD'];
const allowedTools = agent.allowedTools;

const mappedSchema = allowedTools.map(toolName => {
  const tool = toolsRegistry[toolName];
  if (!tool) return null;
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
  }
}).filter(Boolean);

console.log("MAPPED TOOLS:", mappedSchema.length);
console.log("FIRST TOOL:", JSON.stringify(mappedSchema[0], null, 2));
