import re
import sys

with open("d:\\CIC ERP\\components\\AgentManager.tsx", "r", encoding="utf-8") as f:
    content = f.read()

# 1. Add import
content = content.replace("import { cn } from '../lib/utils';", "import { cn } from '../lib/utils';\nimport { useSlidePanel } from '../contexts/SlidePanelContext';")

# 2. Add useSlidePanel in AgentManager
content = content.replace(
    "const [collapsedCategories, setCollapsedCategories] = useState<Set<string>>(new Set());",
    "const { openPanel, closePanel } = useSlidePanel();\n  const [collapsedCategories, setCollapsedCategories] = useState<Set<string>>(new Set());"
)

# 3. Modify onClick to use openPanel
old_onclick = """              onClick={() => { 
                setSelectedAgent(agent); 
                setEditingForm({
                  description: agent.description,
                  system_prompt: agent.system_prompt,
                  allowed_tools: agent.allowed_tools || [],
                  allowed_roles: agent.allowed_roles || [],
                  allowed_users: agent.allowed_users || [],
                  preferred_model: agent.preferred_model,
                  data_scope: agent.data_scope
                }); 
                setUserSearchText('');
              }}"""

new_onclick = """              onClick={() => { 
                openPanel({
                  id: `agent-${agent.id}`,
                  title: `Agent: ${agent.name}`,
                  icon: renderIcon(agent.icon, 16),
                  component: (
                    <AgentDetailPanel 
                      agent={agent}
                      canManage={canManage}
                      employees={employees}
                      roles={roles}
                      onSave={async (id, updates) => {
                        await AgentConfigService.update(id, updates);
                        setAgents(prev => prev.map(a => a.id === id ? { ...a, ...updates } : a));
                      }}
                      onToggleActive={handleToggleActive}
                      onClose={() => closePanel(`agent-${agent.id}`)}
                      renderIcon={renderIcon}
                    />
                  )
                });
              }}"""
content = content.replace(old_onclick, new_onclick)

# Extract detail panel
detail_panel_marker = "{/* Detail Panel (slide-in from right) */}"
idx_start = content.find(detail_panel_marker)

# Find the end of AgentManager.
idx_end_component = content.rfind("export default AgentManager;")

extracted_block = content[idx_start:idx_end_component]

# Let's clean up the extracted block to build AgentDetailPanel
# The extracted block starts with `{/* Detail Panel (slide-in from right) */}`
# then `{selectedAgent && (`
# then `<>`
# then `<div className="fixed inset-0... />`
# then `<div className="fixed inset-y-0 right-0...`
# We want to replace the `fixed` wrappers.

new_extracted = extracted_block

# Remove {selectedAgent && ( <>
new_extracted = re.sub(r'\{selectedAgent && \(\s*<>\s*', '', new_extracted, 1)

# Remove the backdrop div
new_extracted = re.sub(r'<div className="fixed inset-0 bg-black/30 backdrop-blur-sm z-40" onClick=\{[^}]+\} />\s*', '', new_extracted, 1)

# Replace the panel container div with our flex div
new_extracted = new_extracted.replace(
    '<div className="fixed inset-y-0 right-0 w-[95vw] xl:w-[90vw] max-w-none bg-white dark:bg-slate-950 shadow-2xl z-50 flex flex-col animate-in slide-in-from-right duration-300">',
    '<div className="flex flex-col h-full bg-white dark:bg-slate-950">'
)

# Fix onClick handlers
new_extracted = new_extracted.replace('onClick={() => setSelectedAgent(null)}', 'onClick={onClose}')
new_extracted = new_extracted.replace('onClick={() => handleToggleActive(selectedAgent)}', 'onClick={() => onToggleActive(selectedAgent)}')
new_extracted = new_extracted.replace('onClick={handleSaveConfig}', 'onClick={handleSaveConfig}')

# At the end of extracted_block, there are two closing tags for the fragments:
#           </div>
#         </>
#       )}
# We need to remove them. Since Tool Config Modal is also inside the block, the end of the block looks like:
#       {configuringTool && (
#         <ToolDetailModal ... />
#       )}
#     </div>
#   );
# };
# Wait, the extracted_block goes all the way to `export default AgentManager;`.
# So it includes the end of AgentManager component!
# Let's see: The original AgentManager component ended with:
#           </div>
#         </>
#       )}
#       {/* Tool Config Modal */}
#       ...
#     </div>
#   );
# };

# We just remove `        </>\n      )}`
new_extracted = new_extracted.replace('        </>\n      )}\n      {/* Tool Config Modal */}', '      {/* Tool Config Modal */}')
# Also replace `selectedAgent` with `agent`
new_extracted = new_extracted.replace('selectedAgent', 'agent')
# except in `setEditingForm({ description: selectedAgent.description ...` but wait, `AgentDetailPanel` doesn't have `selectedAgent`, it will have `agent`.

# Remove handleSaveConfig from AgentManager
content = re.sub(r'  const handleSaveConfig = async \(\) => \{[\s\S]*?\n  \};\n', '', content)

# Remove the extracted_block from AgentManager's body
# We must leave the closing tags for AgentManager
content = content.replace(extracted_block, '    </div>\n  );\n};\n\n')

agent_detail_panel_code = f"""
interface AgentDetailPanelProps {{
  agent: AgentConfigRow;
  canManage: boolean;
  employees: {{id: string, name: string}}[];
  roles: any[];
  onSave: (id: string, updates: Partial<AgentConfigRow>) => Promise<void>;
  onToggleActive: (agent: AgentConfigRow) => Promise<void>;
  onClose: () => void;
  renderIcon: (iconName: string, size?: number) => React.ReactNode;
}}

const AgentDetailPanel: React.FC<AgentDetailPanelProps> = ({{
  agent,
  canManage,
  employees,
  roles,
  onSave,
  onToggleActive,
  onClose,
  renderIcon
}}) => {{
  const [editingForm, setEditingForm] = useState<Partial<AgentConfigRow>>({{
    description: agent.description,
    system_prompt: agent.system_prompt,
    allowed_tools: agent.allowed_tools || [],
    allowed_roles: agent.allowed_roles || [],
    allowed_users: agent.allowed_users || [],
    preferred_model: agent.preferred_model,
    data_scope: agent.data_scope
  }});
  const [configuringTool, setConfiguringTool] = useState<OpenClawTool | null>(null);
  const [toolSearchQuery, setToolSearchQuery] = useState('');
  const [collapsedCategories, setCollapsedCategories] = useState<Set<string>>(new Set());
  const [userSearchText, setUserSearchText] = useState('');

  const handleSaveConfig = async () => {{
    await onSave(agent.id, editingForm);
  }};

  return (
{new_extracted}
"""

# Append AgentDetailPanel before `export default AgentManager;`
content = content.replace("export default AgentManager;", agent_detail_panel_code + "\nexport default AgentManager;")

with open("d:\\CIC ERP\\components\\AgentManager.tsx", "w", encoding="utf-8") as f:
    f.write(content)

print("Done")
