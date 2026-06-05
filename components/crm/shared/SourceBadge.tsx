/**
 * SourceBadge — Badge hiển thị nguồn lead với icon tương ứng
 * Dùng trong Lead cards, list rows, detail panels
 */

import React from 'react';
import {
  Globe, Mail, Phone, Handshake, MessageCircle,
  Calendar, FileSpreadsheet, Link, MoreHorizontal,
} from 'lucide-react';
import type { LeadSource } from '../../../types/crm';
import { LEAD_SOURCE_LABELS } from '../../../types/crm';

const SOURCE_ICON_MAP: Record<LeadSource, React.ElementType> = {
  website: Globe,
  email: Mail,
  phone: Phone,
  referral: Handshake,
  social: MessageCircle,
  event: Calendar,
  import: FileSpreadsheet,
  api: Link,
  other: MoreHorizontal,
};

const SOURCE_COLORS: Record<LeadSource, {
  text: string;
  bg: string;
  darkText: string;
  darkBg: string;
}> = {
  website: { text: 'text-blue-700', bg: 'bg-blue-50', darkText: 'dark:text-blue-400', darkBg: 'dark:bg-blue-900/20' },
  email: { text: 'text-violet-700', bg: 'bg-violet-50', darkText: 'dark:text-violet-400', darkBg: 'dark:bg-violet-900/20' },
  phone: { text: 'text-green-700', bg: 'bg-green-50', darkText: 'dark:text-green-400', darkBg: 'dark:bg-green-900/20' },
  referral: { text: 'text-amber-700', bg: 'bg-amber-50', darkText: 'dark:text-amber-400', darkBg: 'dark:bg-amber-900/20' },
  social: { text: 'text-pink-700', bg: 'bg-pink-50', darkText: 'dark:text-pink-400', darkBg: 'dark:bg-pink-900/20' },
  event: { text: 'text-indigo-700', bg: 'bg-indigo-50', darkText: 'dark:text-indigo-400', darkBg: 'dark:bg-indigo-900/20' },
  import: { text: 'text-teal-700', bg: 'bg-teal-50', darkText: 'dark:text-teal-400', darkBg: 'dark:bg-teal-900/20' },
  api: { text: 'text-cyan-700', bg: 'bg-cyan-50', darkText: 'dark:text-cyan-400', darkBg: 'dark:bg-cyan-900/20' },
  other: { text: 'text-slate-600', bg: 'bg-slate-50', darkText: 'dark:text-slate-400', darkBg: 'dark:bg-slate-800' },
};

interface SourceBadgeProps {
  source?: string;
  size?: 'sm' | 'md';
  showLabel?: boolean;
  className?: string;
}

export default function SourceBadge({ source, size = 'sm', showLabel = true, className = '' }: SourceBadgeProps) {
  if (!source) return null;

  const validSource = (source as LeadSource) in SOURCE_ICON_MAP ? source as LeadSource : 'other';
  const Icon = SOURCE_ICON_MAP[validSource];
  const colors = SOURCE_COLORS[validSource];
  const label = LEAD_SOURCE_LABELS[validSource] || source;

  const sizeClasses = size === 'sm'
    ? 'text-[10px] px-1.5 py-0.5 gap-0.5'
    : 'text-xs px-2 py-1 gap-1';

  const iconSize = size === 'sm' ? 10 : 12;

  return (
    <span
      className={`
        inline-flex items-center rounded-full font-medium whitespace-nowrap
        ${sizeClasses}
        ${colors.bg} ${colors.text} ${colors.darkBg} ${colors.darkText}
        ${className}
      `}
      title={label}
    >
      <Icon size={iconSize} />
      {showLabel && <span>{label}</span>}
    </span>
  );
}
