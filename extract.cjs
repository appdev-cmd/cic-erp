const fs = require('fs');
const content = fs.readFileSync('components/tasks/TasksPage.tsx', 'utf8');
const lines = content.split('\n');

const startIndex = lines.findIndex(l => l.includes('const BitrixListView: React.FC<{')) - 4;
const endIndex = lines.findIndex(l => l.includes('const DeadlineView: React.FC<{')) - 4;

const bitrixCode = lines.slice(startIndex, endIndex).join('\n');

const imports = `import React, { useState, useEffect, useMemo } from 'react';
import { 
  CheckSquare, ChevronRight, Play, CheckCircle2, Pin, 
  AlertTriangle, Calendar, Plus, MessageSquare, ArrowUpDown, ChevronUp, ChevronDown
} from 'lucide-react';
import { Task, TaskStatus } from '../../types/taskTypes';
import { DiscussionService } from '../../services/discussionService';
import { formatDateTime } from '../../utils/formatters';
import {
  PRIORITY_CONFIG,
  COLUMN_KEYS,
  ColumnKey,
  COL_LABELS,
  COL_RESPONSIVE,
  loadColWidths,
  saveColWidths,
  ResizeHandle,
  QuickTaskInput,
  StatusDropdown,
  DeadlineInput,
  PersonAvatar,
  InlineCommentInput
} from './TasksPageSubComponents';
import PeoplePickerPopover from '../people/PeoplePickerPopover';

`;

fs.writeFileSync('components/tasks/views/BitrixListView.tsx', imports + bitrixCode);
console.log('Extracted BitrixListView');
