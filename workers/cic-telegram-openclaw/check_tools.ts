import { NATIVE_TOOLS_SCHEMA } from './src/agent/erpReactAgent.js';
import { isValidAgentTool } from './src/agent/erpToolsExecutor.js';

let missing = false;
for (const t of NATIVE_TOOLS_SCHEMA) {
  if (!isValidAgentTool(t.function.name)) {
    console.log("MISSING:", t.function.name);
    missing = true;
  }
}
if (!missing) console.log("ALL TOOLS MAPPED CORRECTLY!");
