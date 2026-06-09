import React, { useState, useEffect } from 'react';
import { CalendarDays, AlertCircle, ChevronLeft, ChevronRight, User, MapPin, AlignLeft, Info } from 'lucide-react';
import { FacilityService } from '../../services/facilityService';
import { InternalRequest, Facility, FacilityType } from '../../types/hrmTypes';
import { useAuth } from '../../contexts/AuthContext';
import { formatDateShort } from '../../utils/formatters';

interface FacilityCalendarProps {
  onCreateRequest?: (facilityId: string, startTime: string) => void;
}

const FacilityCalendar: React.FC<FacilityCalendarProps> = ({ onCreateRequest }) => {
  const { profile: currentEmployee } = useAuth();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<'timeline' | 'month'>('timeline');
  const [filterType, setFilterType] = useState<FacilityType | 'all'>('all');
  
  const [facilities, setFacilities] = useState<Facility[]>([]);
  const [bookings, setBookings] = useState<InternalRequest[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const scrollRef = React.useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadData();
  }, [currentDate, viewMode, filterType]);

  useEffect(() => {
    if (viewMode === 'timeline' && scrollRef.current) {
      scrollRef.current.scrollTop = 8 * 60; // scroll to 8 AM
    }
  }, [viewMode, currentDate, facilities]);

  const loadData = async () => {
    setIsLoading(true);
    try {
      // 1. Load active facilities
      const facs = await FacilityService.getActive(filterType === 'all' ? undefined : filterType);
      setFacilities(facs);

      // 2. Determine date range based on viewMode
      let startDateStr, endDateStr;
      if (viewMode === 'timeline') {
        // Week range: Monday to Sunday
        const day = currentDate.getDay();
        const diff = currentDate.getDate() - day + (day === 0 ? -6 : 1); // adjust when day is sunday
        const startOfWeek = new Date(currentDate.setDate(diff));
        startOfWeek.setHours(0, 0, 0, 0);
        
        const endOfWeek = new Date(startOfWeek);
        endOfWeek.setDate(startOfWeek.getDate() + 6);
        endOfWeek.setHours(23, 59, 59, 999);
        
        startDateStr = startOfWeek.toISOString();
        endDateStr = endOfWeek.toISOString();
      } else {
        // Month range
        const startOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
        const endOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);
        endOfMonth.setHours(23, 59, 59, 999);
        
        startDateStr = startOfMonth.toISOString();
        endDateStr = endOfMonth.toISOString();
      }

      // 3. Load bookings
      const reqs = await FacilityService.getBookingsByDateRange(
        startDateStr,
        endDateStr,
        filterType === 'all' ? undefined : filterType
      );
      setBookings(reqs);

    } catch (e) {
      console.error('Lỗi tải lịch CSVC:', e);
    } finally {
      setIsLoading(false);
    }
  };

  const nextPeriod = () => {
    const newDate = new Date(currentDate);
    if (viewMode === 'timeline') {
      newDate.setDate(currentDate.getDate() + 7);
    } else {
      newDate.setMonth(currentDate.getMonth() + 1);
    }
    setCurrentDate(newDate);
  };

  const prevPeriod = () => {
    const newDate = new Date(currentDate);
    if (viewMode === 'timeline') {
      newDate.setDate(currentDate.getDate() - 7);
    } else {
      newDate.setMonth(currentDate.getMonth() - 1);
    }
    setCurrentDate(newDate);
  };

  const goToToday = () => setCurrentDate(new Date());

  // --- TIMELINE VIEW HELPERS ---
  const getDaysOfWeek = () => {
    const day = currentDate.getDay();
    const diff = currentDate.getDate() - day + (day === 0 ? -6 : 1);
    const monday = new Date(currentDate);
    monday.setDate(diff);

    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      return d;
    });
  };

  const workingHours = Array.from({ length: 25 }, (_, i) => i);

  const getLayoutBookingsForDay = (day: Date) => {
    const dayBookings = bookings.filter(b => {
      if (!b.details?.start_time || !b.details?.end_time) return false;
      const bStart = new Date(b.details.start_time);
      const bEnd = new Date(b.details.end_time);
      const dayStart = new Date(day); dayStart.setHours(0,0,0,0);
      const dayEnd = new Date(day); dayEnd.setHours(23,59,59,999);
      return bStart < dayEnd && bEnd > dayStart;
    });

    // sort by start time
    dayBookings.sort((a, b) => new Date(a.details!.start_time).getTime() - new Date(b.details!.start_time).getTime());

    let columns: InternalRequest[][] = [];
    const layoutMap = new Map();

    dayBookings.forEach(b => {
      let placed = false;
      for (let i = 0; i < columns.length; i++) {
        const col = columns[i];
        const lastBooking = col[col.length - 1];
        if (new Date(lastBooking.details!.end_time).getTime() <= new Date(b.details!.start_time).getTime()) {
          col.push(b);
          layoutMap.set(b.id, { colIndex: i });
          placed = true;
          break;
        }
      }
      if (!placed) {
        layoutMap.set(b.id, { colIndex: columns.length });
        columns.push([b]);
      }
    });

    const maxCols = columns.length || 1;
    return dayBookings.map(b => {
      const layout = layoutMap.get(b.id);
      return {
        booking: b,
        left: (layout.colIndex / maxCols) * 100,
        width: 100 / maxCols
      };
    });
  };

  const calculateVerticalBookingStyle = (b: InternalRequest, day: Date, left: number, width: number) => {
    if (!b.details?.start_time || !b.details?.end_time) return {};
    const start = new Date(b.details.start_time);
    const end = new Date(b.details.end_time);

    let sHour = start.getHours() + start.getMinutes() / 60;
    let eHour = end.getHours() + end.getMinutes() / 60;

    const totalHours = 24;
    const topPercent = (sHour / totalHours) * 100;
    const heightPercent = ((eHour - sHour) / totalHours) * 100;

    let colorCls = 'bg-slate-200/90 border-slate-300 text-slate-800 dark:bg-slate-700 dark:border-slate-600 dark:text-slate-200 hover:bg-slate-300 dark:hover:bg-slate-600';
    if (b.status === 'approved') {
      colorCls = 'bg-emerald-100/90 border-emerald-300 text-emerald-800 dark:bg-emerald-900/80 dark:border-emerald-700/50 dark:text-emerald-200 hover:bg-emerald-200 dark:hover:bg-emerald-800';
    } else if (b.status === 'pending_unit' || b.status === 'pending_admin') {
      colorCls = 'bg-amber-100/90 border-amber-300 text-amber-800 dark:bg-amber-900/80 dark:border-amber-700/50 dark:text-amber-200 hover:bg-amber-200 dark:hover:bg-amber-800';
    }

    return {
      style: { 
        top: `${Math.max(0, topPercent)}%`, 
        height: `${Math.min(100, heightPercent)}%`,
        left: `${left}%`,
        width: `calc(${width}% - 2px)`
      },
      className: colorCls
    };
  };

  // --- MONTH VIEW HELPERS ---
  const getDaysInMonth = (year: number, month: number) => new Date(year, month + 1, 0).getDate();
  const daysInMonth = getDaysInMonth(currentDate.getFullYear(), currentDate.getMonth());
  const daysArray = Array.from({ length: daysInMonth }, (_, i) => i + 1);

  const getBookingsForDay = (day: number) => {
    const checkDateStr = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const checkDate = new Date(checkDateStr);
    
    return bookings.filter(b => {
      if (!b.details?.start_time || !b.details?.end_time) return false;
      const start = new Date(b.details.start_time);
      const end = new Date(b.details.end_time);
      // Strip time from start/end to compare dates properly
      start.setHours(0,0,0,0);
      end.setHours(23,59,59,999);
      return checkDate >= start && checkDate <= end;
    });
  };

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm overflow-hidden flex flex-col h-full animate-fade-in">
      {/* Header */}
      <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4 shrink-0">
        <div className="flex items-center gap-3">
          <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-lg">
            <button
              onClick={() => setViewMode('timeline')}
              className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${viewMode === 'timeline' ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'}`}
            >
              Timeline Tuần
            </button>
            <button
              onClick={() => setViewMode('month')}
              className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${viewMode === 'month' ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'}`}
            >
              Lịch Tháng
            </button>
          </div>
          
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value as any)}
            className="text-sm border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 rounded-lg py-1.5 px-3"
          >
            <option value="all">Tất cả tài sản</option>
            <option value="meeting_room">Phòng họp</option>
            <option value="vehicle">Xe công tác</option>
          </select>
        </div>

        <div className="flex items-center gap-3">
          <button onClick={goToToday} className="px-3 py-1.5 text-sm font-medium bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-lg">
            Hôm nay
          </button>
          <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 rounded-lg p-1">
            <button onClick={prevPeriod} className="p-1 rounded hover:bg-white dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300">
              <ChevronLeft size={16} />
            </button>
            <span className="font-semibold text-slate-800 dark:text-slate-200 min-w-[150px] text-center text-sm">
              {viewMode === 'timeline' ? 
                `Tuần ${currentDate.getDate()}/${currentDate.getMonth()+1}` : 
                `Tháng ${currentDate.getMonth() + 1}, ${currentDate.getFullYear()}`
              }
            </span>
            <button onClick={nextPeriod} className="p-1 rounded hover:bg-white dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300">
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-hidden relative p-0 bg-slate-50/50 dark:bg-slate-900 flex flex-col">
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-white/50 dark:bg-slate-900 backdrop-blur-sm z-50">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600 dark:border-emerald-400"></div>
          </div>
        )}

        {viewMode === 'timeline' && (
          <div className="flex-1 flex flex-col min-w-[800px] overflow-hidden">
            {/* Timeline Header - Days */}
            <div className="sticky top-0 z-30 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 flex">
              <div className="w-16 shrink-0 border-r border-slate-200 dark:border-slate-800 p-3 bg-slate-50 dark:bg-slate-800 flex flex-col justify-end text-xs text-slate-400">
                GMT+07
              </div>
              <div className="flex-1 grid grid-cols-7 divide-x divide-slate-200 dark:divide-slate-800">
                {getDaysOfWeek().map((d, i) => {
                  const isToday = new Date().toDateString() === d.toDateString();
                  return (
                    <div key={i} className={`p-2 text-center ${isToday ? 'bg-blue-50/50 dark:bg-blue-900/10' : ''}`}>
                      <div className="text-xs text-slate-500 dark:text-slate-400">
                        {['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'][d.getDay()]}
                      </div>
                      <div className={`text-sm font-bold ${isToday ? 'text-blue-600 dark:text-blue-400' : 'text-slate-900 dark:text-slate-100'}`}>
                        {d.getDate()}/{d.getMonth()+1}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Timeline Body */}
            <div className="flex-1 overflow-y-auto bg-white dark:bg-slate-900 scroll-smooth" ref={scrollRef}>
              <div className="flex h-[1440px]">
                {/* Hour Labels */}
                <div className="w-16 shrink-0 flex flex-col border-r border-slate-200 dark:border-slate-800 relative z-20 bg-white dark:bg-slate-900">
                  {workingHours.slice(0, -1).map(h => (
                    <div key={h} className="flex-1 h-[60px] text-right pr-2 text-[10px] text-slate-400 font-medium relative">
                      <span className="absolute -top-2 right-2">{String(h).padStart(2, '0')}:00</span>
                    </div>
                  ))}
                </div>

              {/* Grid & Bookings */}
              <div className="flex-1 relative flex">
                {/* Horizontal Grid Lines */}
                <div className="absolute inset-0 pointer-events-none flex flex-col z-0">
                  {workingHours.slice(0, -1).map(h => (
                    <div key={h} className="h-[60px] border-t border-slate-100 dark:border-slate-800 shrink-0" />
                  ))}
                  <div className="border-t border-slate-100 dark:border-slate-800" />
                </div>

                {/* Day Columns */}
                <div className="flex-1 grid grid-cols-7 divide-x divide-slate-200 dark:divide-slate-800 relative z-10">
                  {getDaysOfWeek().map((d, i) => {
                    const isToday = new Date().toDateString() === d.toDateString();
                    const layoutBookings = getLayoutBookingsForDay(d);

                    return (
                      <div 
                        key={i} 
                        className={`relative group ${isToday ? 'bg-blue-50/10 dark:bg-blue-900/5' : ''}`}
                        onClick={(e) => {
                          // Determine clicked hour
                          const rect = e.currentTarget.getBoundingClientRect();
                          const y = e.clientY - rect.top;
                          const clickedHour = Math.floor(y / 60);
                          if (onCreateRequest) {
                            const dStr = new Date(d);
                            dStr.setHours(clickedHour, 0, 0, 0);
                            onCreateRequest('', dStr.toISOString());
                          }
                        }}
                      >
                        {layoutBookings.map(({ booking: b, left, width }) => {
                          const { style, className } = calculateVerticalBookingStyle(b, d, left, width);
                          return (
                            <div
                              key={b.id}
                              className={`absolute border rounded-md p-1.5 flex flex-col overflow-hidden shadow-sm transition-all cursor-help hover:z-20 hover:shadow-md ${className}`}
                              style={{ ...style, borderLeftWidth: '4px', borderLeftColor: b.facility?.color || 'currentColor' }}
                              title={`Phòng/Xe: ${b.facility?.name || 'N/A'}\nNgười đặt: ${b.employee_name}\nĐơn vị: ${b.unit_name}\nTừ: ${b.details?.start_time ? new Date(b.details.start_time).toLocaleTimeString('vi-VN', {hour:'2-digit', minute:'2-digit'}) : ''} Đến: ${b.details?.end_time ? new Date(b.details.end_time).toLocaleTimeString('vi-VN', {hour:'2-digit', minute:'2-digit'}) : ''}\nMục đích: ${b.title}`}
                              onClick={(e) => e.stopPropagation()}
                            >
                              <div className="text-[10px] font-bold leading-tight truncate text-slate-800 dark:text-slate-100 flex items-center gap-1">
                                {b.facility?.name}
                              </div>
                              <div className="text-[10px] truncate opacity-90 font-medium">
                                {b.title}
                              </div>
                              <div className="text-[9px] truncate opacity-75 mt-auto pt-1">
                                {b.employee_name?.split(' ').pop()}
                                {b.status === 'pending_unit' && ' (Chờ)'}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    );
                  })}
                </div>
              </div>
              </div>
            </div>
          </div>
        )}

        {viewMode === 'month' && (
          <div className="p-4">
             <div className="grid grid-cols-7 gap-px bg-slate-200 dark:bg-slate-700 border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden shadow-sm">
              {['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'].map((day, i) => (
                <div key={day} className={`bg-slate-50 dark:bg-slate-800 p-2 text-center text-xs font-bold uppercase tracking-wider ${i === 0 || i === 6 ? 'text-rose-500 dark:text-rose-400' : 'text-slate-500 dark:text-slate-400'}`}>
                  {day}
                </div>
              ))}

              {Array.from({ length: new Date(currentDate.getFullYear(), currentDate.getMonth(), 1).getDay() }).map((_, i) => (
                <div key={`empty-${i}`} className="bg-slate-50/30 dark:bg-slate-800 p-2 min-h-[120px]" />
              ))}

              {daysArray.map(day => {
                const dateObj = new Date(currentDate.getFullYear(), currentDate.getMonth(), day);
                const isWeekend = dateObj.getDay() === 0 || dateObj.getDay() === 6;
                const isToday = new Date().toDateString() === dateObj.toDateString();
                const dayBookings = getBookingsForDay(day);

                return (
                  <div 
                    key={day} 
                    className={`bg-white dark:bg-slate-900 p-2 min-h-[120px] flex flex-col gap-1 transition-colors hover:bg-slate-50 dark:hover:bg-slate-800 ${isWeekend ? 'bg-slate-50/50 dark:bg-slate-800' : ''}`}
                    onClick={() => {
                      if (onCreateRequest) {
                        const dStr = new Date(dateObj);
                        dStr.setHours(8,0,0,0);
                        onCreateRequest('', dStr.toISOString()); // Cannot pre-select facility in month view generally
                      }
                    }}
                  >
                    <div className="flex justify-between items-start mb-1">
                      <span className={`text-sm font-semibold w-6 h-6 flex items-center justify-center rounded-full ${
                        isToday ? 'bg-blue-500 text-white shadow-sm' : 
                        isWeekend ? 'text-rose-400 dark:text-rose-500' : 
                        'text-slate-700 dark:text-slate-300'
                      }`}>
                        {day}
                      </span>
                      {dayBookings.length > 0 && (
                        <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500">{dayBookings.length} lịch</span>
                      )}
                    </div>
                    
                    <div className="flex-1 space-y-1 overflow-y-auto scrollbar-hide">
                      {dayBookings.slice(0, 4).map(b => (
                        <div 
                          key={b.id} 
                          className={`px-1.5 py-0.5 rounded text-[10px] leading-tight truncate border ${b.status === 'approved' ? 'bg-emerald-50 border-emerald-200 text-emerald-700 dark:bg-emerald-900/30 dark:border-emerald-800/50 dark:text-emerald-300' : 'bg-amber-50 border-amber-200 text-amber-700 dark:bg-amber-900/30 dark:border-amber-800/50 dark:text-amber-300'}`}
                          title={`${b.facility?.name} - ${b.employee_name}`}
                        >
                          <span className="font-semibold">{b.facility?.name?.split(' ')[0]}:</span> {b.title}
                        </div>
                      ))}
                      {dayBookings.length > 4 && (
                        <div className="text-[10px] text-center text-slate-400 font-medium">+ {dayBookings.length - 4} lịch khác</div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Footer Legend */}
      <div className="px-5 py-3 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800 flex items-center gap-4 text-xs font-medium text-slate-600 dark:text-slate-400 shrink-0">
        <span className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-sm bg-emerald-100 border border-emerald-300 dark:bg-emerald-900/40 dark:border-emerald-700" />
          Đã duyệt
        </span>
        <span className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-sm bg-amber-100 border border-amber-300 dark:bg-amber-900/40 dark:border-amber-700" />
          Chờ duyệt
        </span>
        <div className="flex-1"></div>
        <span className="flex items-center gap-1 text-slate-400 dark:text-slate-500">
          <Info size={14} /> Click vào ô trống để tạo đề xuất
        </span>
      </div>
    </div>
  );
};

export default FacilityCalendar;
