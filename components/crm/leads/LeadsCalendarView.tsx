import React, { useState, useMemo } from 'react';
import { CrmLead } from '../../../types';
import { startOfMonth, endOfMonth, eachDayOfInterval, format, isSameMonth, isToday, startOfWeek, endOfWeek, isSameDay } from 'date-fns';
import { vi } from 'date-fns/locale';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface Props {
  leads: CrmLead[];
}

const LeadsCalendarView: React.FC<Props> = ({ leads }) => {
  const [currentDate, setCurrentDate] = useState(new Date());

  const daysInMonth = useMemo(() => {
    const start = startOfWeek(startOfMonth(currentDate), { weekStartsOn: 1 });
    const end = endOfWeek(endOfMonth(currentDate), { weekStartsOn: 1 });
    return eachDayOfInterval({ start, end });
  }, [currentDate]);

  const prevMonth = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  const nextMonth = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
  const goToday = () => setCurrentDate(new Date());

  return (
    <div className="bg-white dark:bg-slate-900 rounded-lg shadow-sm border border-slate-200 dark:border-slate-800 flex flex-col h-full min-h-[600px]">
      {/* Calendar Header */}
      <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-700">
        <div className="flex items-center gap-4">
          <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-100 capitalize">
            {format(currentDate, 'MMMM yyyy', { locale: vi })}
          </h2>
          <div className="flex items-center bg-slate-100 dark:bg-slate-800 rounded-lg p-1">
            <button onClick={prevMonth} className="p-1 hover:bg-white dark:hover:bg-slate-700 rounded text-slate-600 dark:text-slate-300 transition-colors">
              <ChevronLeft className="w-5 h-5" />
            </button>
            <button onClick={goToday} className="px-3 py-1 text-sm font-medium hover:bg-white dark:hover:bg-slate-700 rounded text-slate-600 dark:text-slate-300 transition-colors">
              Hôm nay
            </button>
            <button onClick={nextMonth} className="p-1 hover:bg-white dark:hover:bg-slate-700 rounded text-slate-600 dark:text-slate-300 transition-colors">
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>

      {/* Calendar Grid */}
      <div className="flex-1 flex flex-col">
        {/* Week Days */}
        <div className="grid grid-cols-7 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
          {['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'].map((day) => (
            <div key={day} className="p-2 text-center text-sm font-medium text-slate-500 dark:text-slate-400">
              {day}
            </div>
          ))}
        </div>

        {/* Days */}
        <div className="flex-1 grid grid-cols-7 grid-rows-5 lg:grid-rows-auto">
          {daysInMonth.map((day, idx) => {
            const isCurrentMonth = isSameMonth(day, currentDate);
            const isDayToday = isToday(day);
            const dayLeads = leads.filter(l => isSameDay(new Date(l.created_at), day));

            return (
              <div 
                key={day.toISOString()} 
                className={`min-h-[100px] border-b border-r border-slate-200 dark:border-slate-700 p-2 flex flex-col gap-1 transition-colors
                  ${!isCurrentMonth ? 'bg-slate-50/50 dark:bg-slate-800/20' : 'bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800/50'}
                  ${idx % 7 === 6 ? 'border-r-0' : ''}
                `}
              >
                <div className="flex justify-between items-center mb-1">
                  <span className={`text-sm font-medium w-6 h-6 flex items-center justify-center rounded-full
                    ${isDayToday 
                      ? 'bg-indigo-600 text-white' 
                      : isCurrentMonth ? 'text-slate-700 dark:text-slate-200' : 'text-slate-400 dark:text-slate-500'
                    }
                  `}>
                    {format(day, 'd')}
                  </span>
                </div>
                
                {/* Events / Leads */}
                <div className="flex-1 overflow-y-auto space-y-1 pr-1">
                  {dayLeads.map(lead => (
                    <div 
                      key={lead.id} 
                      className="text-xs px-2 py-1 rounded truncate cursor-pointer transition-opacity hover:opacity-80"
                      style={{
                        backgroundColor: lead.stage?.color ? `${lead.stage.color}20` : '#F3F4F6',
                        color: lead.stage?.color || '#374151',
                        borderLeft: `3px solid ${lead.stage?.color || '#D1D5DB'}`
                      }}
                      title={lead.title}
                    >
                      {lead.title}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default LeadsCalendarView;
