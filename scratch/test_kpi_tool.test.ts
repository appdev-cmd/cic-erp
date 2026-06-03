import { test } from 'vitest';
import { supabase } from '../lib/supabase';

test("inspect agent_tool_configs in DB", async () => {
  console.log("=== INSPECTING AGENT_TOOL_CONFIGS IN DB ===");
  
  try {
    const { data, error } = await supabase
      .from('agent_tool_configs')
      .select('*');

    if (error) throw error;

    console.log("Tool configs count in DB:", data?.length);
    data?.forEach(config => {
      console.log(`\nTool: ${config.tool_name}`);
      console.log(`Active: ${config.is_active}`);
      console.log(`Custom Description: ${config.custom_description}`);
    });
  } catch (err: any) {
    console.error("Error inspecting DB:", err);
  }
}, 30000);
