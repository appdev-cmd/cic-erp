const fs = require('fs');
const content = fs.readFileSync('components/tasks/TasksPage.tsx', 'utf8');
const lines = content.split('\n');

const bStart = lines.findIndex(l => l.includes('// LIST VIEW (Bitrix24-style table)'));
const bEnd = lines.findIndex(l => l.includes('// DEADLINE VIEW (Kanban by deadline'));
const pEnd = lines.findIndex(l => l.includes('// BULK ACTIONS BAR'));
const tPageStart = lines.findIndex(l => l.includes('// TASKS PAGE (main)'));

// We want to remove lines from bStart to tPageStart - 1 (or right above TASKS PAGE main)
const newLines = [];
let i = 0;
while (i < lines.length) {
  if (i === bStart) {
    // skip until tPageStart
    while (i < lines.length && !lines[i].includes('// TASKS PAGE (main)')) {
      i++;
    }
  } else {
    newLines.push(lines[i]);
    i++;
  }
}

// Now we need to add the imports at the top
const importsStr = `import { BitrixListView } from './views/BitrixListView';
import { DeadlineView } from './views/DeadlineView';
import { PlannerView } from './views/PlannerView';
import { BulkActionsBar } from './views/BulkActionsBar';`;

const finalContent = newLines.join('\n').replace(
  "import { GanttView } from './GanttView';", 
  "import { GanttView } from './GanttView';\n" + importsStr
);

fs.writeFileSync('components/tasks/TasksPage.tsx', finalContent);
console.log('Cleaned TasksPage.tsx');
