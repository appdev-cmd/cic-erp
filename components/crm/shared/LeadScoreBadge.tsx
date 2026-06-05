/**
 * LeadScoreBadge — Badge hiển thị điểm lead 0-100
 * Màu theo band: Cold (<40) / Warm (40-69) / Hot (≥70)
 * Hover → tooltip breakdown 4 categories
 */

import React, { useState, useRef, useEffect } from 'react';
import type { CrmLead } from '../../../types/crm';
import { calcLeadScore, getScoreBand, getScoreBreakdown } from '../../../lib/crm/leadScoring';

interface LeadScoreBadgeProps {
  lead: CrmLead;
  size?: 'sm' | 'md';
  showLabel?: boolean;
}

export default function LeadScoreBadge({ lead, size = 'md', showLabel = false }: LeadScoreBadgeProps) {
  const [showTooltip, setShowTooltip] = useState(false);
  const badgeRef = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);

  const score = calcLeadScore(lead);
  const band = getScoreBand(score);
  const breakdown = getScoreBreakdown(lead);

  // Close tooltip on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (tooltipRef.current && !tooltipRef.current.contains(e.target as Node) &&
          badgeRef.current && !badgeRef.current.contains(e.target as Node)) {
        setShowTooltip(false);
      }
    }
    if (showTooltip) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showTooltip]);

  const sizeClasses = size === 'sm' 
    ? 'text-xs px-1.5 py-0.5 min-w-[28px]' 
    : 'text-xs px-2 py-1 min-w-[36px]';

  return (
    <div className="relative inline-flex" ref={badgeRef}>
      <button
        type="button"
        onClick={() => setShowTooltip(!showTooltip)}
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
        className={`
          inline-flex items-center justify-center gap-1 rounded-full font-semibold cursor-pointer
          transition-colors duration-200
          ${sizeClasses}
          ${band.bgColor} ${band.color} ${band.darkBgColor} ${band.darkColor}
        `}
        title={`Score: ${score}/100 (${band.label})`}
      >
        {score}
        {showLabel && <span className="font-normal">{band.label}</span>}
      </button>

      {/* Tooltip breakdown */}
      {showTooltip && (
        <div
          ref={tooltipRef}
          className="absolute z-50 bottom-full left-1/2 -translate-x-1/2 mb-2 w-56
            bg-white dark:bg-slate-900 rounded-lg shadow-xl border border-slate-200 dark:border-slate-700
            p-3 text-xs"
        >
          {/* Arrow */}
          <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-px">
            <div className="w-2 h-2 bg-white dark:bg-slate-900 border-r border-b border-slate-200 dark:border-slate-700 rotate-45 -translate-y-1" />
          </div>

          {/* Header */}
          <div className="flex items-center justify-between mb-2 pb-2 border-b border-slate-200 dark:border-slate-700">
            <span className="font-semibold text-slate-900 dark:text-slate-100">
              Lead Score
            </span>
            <span className={`font-bold text-sm ${band.color} ${band.darkColor}`}>
              {score}/100
            </span>
          </div>

          {/* Breakdown */}
          <div className="space-y-2">
            {breakdown.map((cat) => (
              <div key={cat.category}>
                <div className="flex items-center justify-between text-slate-700 dark:text-slate-300">
                  <span>{cat.category}</span>
                  <span className="font-medium">{cat.score}/{cat.max}</span>
                </div>
                {/* Progress bar */}
                <div className="mt-0.5 h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-300 ${
                      cat.score >= cat.max * 0.7 
                        ? 'bg-emerald-500' 
                        : cat.score >= cat.max * 0.4 
                          ? 'bg-amber-500' 
                          : 'bg-slate-400'
                    }`}
                    style={{ width: `${(cat.score / cat.max) * 100}%` }}
                  />
                </div>
                {/* Details */}
                {cat.details.length > 0 && (
                  <div className="mt-0.5 text-[10px] text-slate-500 dark:text-slate-500">
                    {cat.details.join(' · ')}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
