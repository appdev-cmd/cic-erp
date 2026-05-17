const fs = require('fs');
const path = require('path');

const filePath = path.join('d:\\CIC ERP\\components\\AgentManager.tsx');
let content = fs.readFileSync(filePath, 'utf-8');

// 1. Add useSlidePanel import
content = content.replace(
  "import { cn } from '../lib/utils';",
  "import { cn } from '../lib/utils';\nimport { useSlidePanel } from '../contexts/SlidePanelContext';"
);

// 2. Add openPanel destructure inside AgentManager
content = content.replace(
  "const [collapsedCategories, setCollapsedCategories] = useState<Set<string>>(new Set());",
  "const { openPanel, closePanel } = useSlidePanel();"
);

// 3. Remove state declarations that are moving to AgentDetailPanel
content = content.replace(/  const \[selectedAgent, setSelectedAgent\] = useState<AgentConfigRow \| null>\(null\);\n/, '');
content = content.replace(/  const \[editingForm, setEditingForm\] = useState<Partial<AgentConfigRow>>\(\{\}\);\n/, '');
content = content.replace(/  const \[configuringTool, setConfiguringTool\] = useState<OpenClawTool \| null>\(null\);\n/, '');
content = content.replace(/  const \[toolSearchQuery, setToolSearchQuery\] = useState\(''\);\n/, '');

// 4. Update onClick inside AgentManager to call openPanel
const oldOnClick = `              onClick={() => { 
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
              }}`;

const newOnClick = `              onClick={() => { 
                openPanel({
                  id: \`agent-\${agent.id}\`,
                  title: \`Agent: \${agent.name}\`,
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
                        toast.success('Đã lưu cấu hình Agent');
                        closePanel(\`agent-\${agent.id}\`);
                      }}
                      onToggleActive={handleToggleActive}
                      onClose={() => closePanel(\`agent-\${agent.id}\`)}
                      renderIcon={renderIcon}
                    />
                  )
                });
              }}`;

content = content.replace(oldOnClick, newOnClick);

// 5. Extract the Detail Panel block (from {/* Detail Panel (slide-in from right) */} to its end)
const detailPanelStartIdx = content.indexOf('{/* Detail Panel (slide-in from right) */}');
const toolConfigModalStartIdx = content.indexOf('{/* Tool Config Modal */}');

// We also need to extract Tool Config Modal to AgentDetailPanel
// Wait, the tool config modal uses configuringTool state which is in AgentDetailPanel.
// So let's extract up to the end of the AgentManager component.
const endOfAgentManagerIdx = content.lastIndexOf('export default AgentManager;');

const detailPanelBlock = content.substring(detailPanelStartIdx, toolConfigModalStartIdx);
const modalBlock = content.substring(toolConfigModalStartIdx, endOfAgentManagerIdx - 2); // -2 to exclude the last closing brace of AgentManager.

// Create the new AgentDetailPanel component
let newComponent = `
interface AgentDetailPanelProps {
  agent: AgentConfigRow;
  canManage: boolean;
  employees: {id: string, name: string}[];
  roles: any[];
  onSave: (id: string, updates: Partial<AgentConfigRow>) => Promise<void>;
  onToggleActive: (agent: AgentConfigRow) => Promise<void>;
  onClose: () => void;
  renderIcon: (iconName: string, size?: number) => React.ReactNode;
}

const AgentDetailPanel: React.FC<AgentDetailPanelProps> = ({ 
  agent: selectedAgent, 
  canManage, 
  employees, 
  roles,
  onSave, 
  onToggleActive, 
  onClose, 
  renderIcon 
}) => {
  const [editingForm, setEditingForm] = useState<Partial<AgentConfigRow>>({
    description: selectedAgent.description,
    system_prompt: selectedAgent.system_prompt,
    allowed_tools: selectedAgent.allowed_tools || [],
    allowed_roles: selectedAgent.allowed_roles || [],
    allowed_users: selectedAgent.allowed_users || [],
    preferred_model: selectedAgent.preferred_model,
    data_scope: selectedAgent.data_scope
  });
  const [configuringTool, setConfiguringTool] = useState<OpenClawTool | null>(null);
  const [toolSearchQuery, setToolSearchQuery] = useState('');
  const [collapsedCategories, setCollapsedCategories] = useState<Set<string>>(new Set());
  const [userSearchText, setUserSearchText] = useState('');

  const handleSaveConfig = async () => {
    await onSave(selectedAgent.id, editingForm);
  };

  return (
    <div className="flex flex-col h-full bg-white dark:bg-slate-950">
      {/* Panel Header */}
${detailPanelBlock.substring(detailPanelBlock.indexOf('<div className="flex items-center justify-between px-6 py-4'), detailPanelBlock.lastIndexOf('</>'))}
${modalBlock}
    </div>
  );
};
`;

// Clean up the detailPanelBlock from AgentManager
// We just remove it from content.
content = content.substring(0, detailPanelStartIdx) + content.substring(endOfAgentManagerIdx - 2);

// Replace selectedAgent -> agent inside AgentDetailPanel?
// We aliased \`agent: selectedAgent\` in props, so the existing code will work!
// BUT we need to remove the wrapper \`{selectedAgent && (\` and \`<> <div fixed> <div fixed ...>\`
let panelBody = newComponent;
panelBody = panelBody.replace(/\{selectedAgent && \(\s*<>\s*<div className="fixed inset-0 bg-black\/30 backdrop-blur-sm z-40" onClick=\{[^}]+\} \/>\s*<div className="fixed inset-y-0 right-0 w-\[95vw\] xl:w-\[90vw\] max-w-none bg-white dark:bg-slate-950 shadow-2xl z-50 flex flex-col animate-in slide-in-from-right duration-300">/, '');
// Fix the trailing closing tags
panelBody = panelBody.replace(/          <\/div>\n        <\/>\n      \)\}/, '');
// Change the close button action
panelBody = panelBody.replace(/onClick=\{() => setSelectedAgent\(null\)\}/g, 'onClick={onClose}');
panelBody = panelBody.replace(/onClick=\{() => handleToggleActive\(selectedAgent\)\}/, 'onClick={() => onToggleActive(selectedAgent)}');

// Add AgentDetailPanel above export default
content = content.replace('export default AgentManager;', panelBody + '\n\nexport default AgentManager;');

// remove \`const handleSaveConfig = async () => { ... }\` from AgentManager
content = content.replace(/  const handleSaveConfig = async \(\) => \{[\s\S]*?\n  \};\n/, '');

fs.writeFileSync(filePath, content, 'utf-8');
console.log('Done refactoring!');
