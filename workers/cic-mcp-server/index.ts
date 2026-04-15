import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// WARNING: MCP uses stdout for JSONRPC. Redirect console.log to console.error to prevent logs from corrupting the stream.
console.log = console.error;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables from the root .env or .env.local
dotenv.config({ path: path.resolve(__dirname, '../../.env.local') });
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

// Shim import.meta.env for frontend shared code
if (typeof import.meta.env === 'undefined') {
  (import.meta as any).env = process.env;
} else {
  Object.assign(import.meta.env, process.env);
}

// IMPORTANT: Polyfill or mock window/document if any frontend libs require them. 
// Supabase JS client usually works fine in Node.js.

let registryTools: any;

const server = new Server(
  { name: "cic-erp-mcp", version: "1.0.0" },
  { capabilities: { tools: {} } }
);

server.setRequestHandler(ListToolsRequestSchema, async () => {
  const tools = [];
  
  if (!registryTools) return { tools };

  // Iterate through exported tools in registry
  for (const key of Object.keys(registryTools)) {
    const tool = registryTools[key];
    if (tool && tool.name && typeof tool.execute === 'function') {
      tools.push({
        name: tool.name,
        description: tool.description,
        inputSchema: {
          type: "object",
          properties: tool.schema || {},
          required: Object.keys(tool.schema || {})
        }
      });
    }
  }
  
  return { tools };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  
  if (!registryTools) throw new Error("Registry not initialized");

  for (const key of Object.keys(registryTools)) {
    const tool = registryTools[key];
    if (tool && tool.name === name) {
      try {
        // Mock a user context, you can customize this as needed
        const mockContext = { 
            userId: 'mcp-agent-telegram', 
            role: 'admin',
            // if you need unit filtering etc.
            unitId: undefined 
        };
        
        const result = await tool.execute(args || {}, mockContext);
        const textResult = typeof result === 'string' ? result : JSON.stringify(result, null, 2);
        
        return {
          content: [{ type: "text", text: textResult }],
        };
      } catch (err: any) {
        return {
          content: [{ type: "text", text: `Error executing tool ${name}: ${err.message}` }],
          isError: true,
        };
      }
    }
  }
  
  throw new Error(`Tool not found: ${name}`);
});

async function run() {
  registryTools = await import('../../services/ai/openclaw/tools/registry.js');
  // Start the server via STDIO
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("CIC ERP MCP Server is running...");
}

run().catch(console.error);
