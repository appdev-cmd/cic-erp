import React, { useState, useEffect } from 'react';
import { CalendarDays, AlertCircle, ChevronLeft, ChevronRight, User } from 'lucide-react';
import { LeaveService } from '../../services/leaveService';
import { LeaveRequest } from '../../types/hrmTypes';
import { useAuth } from '../../contexts/AuthContext';
import { formatDateShort } from '../../utils/formatters';

const LeaveCalendar: React.FC = () => {
  const { profile: currentEmployee } = useAuth();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [teamLeaves, setTeamLeaves] = useState<LeaveRequest[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (currentEmployee) {
      loadCalendarData();
    }
  }, [currentEmployee, currentDate]);

  const loadCalendarData = async () => {
    if (!currentEmployee) return;
    setIsLoading(true);
    try {
      const year = currentDate.getFullYear();
      const month = currentDate.getMonth() + 1;
      
      // Load team calendar for current Unit
      // According to business rules: if employee is not a manager, they can't see other people's leaves.
      // But for demo purposes or strictly applying "Nhân viên không xem được lịch của nhân viên khác",
      // we check role/permissions here.
      
      const isManager = currentEmployee.role === 'UnitLeader' || currentEmployee.role === 'AdminUnit';
      
      if (!isManager) {
        // Can only see their own approved leaves
        const reqs = await LeaveService.getRequestsByEmployee(currentEmployee.id, year);
        setTeamLeaves(reqs.filter(r => r.status === 'approved'));
      } else {
        // Can see unit calendar
        const reqs = await LeaveService.getTeamCalendar(currentEmployee.unitId ?? null, year, month);
        setTeamLeaves(reqs);
      }
      
    } catch (e) {
      console.error('Lỗi tải lịch nghỉ phép:', e);
    } finally {
      setIsLoading(false);
    }
  };

  const nextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
  };

  const prevMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  };

  const monthNames = [
    'Tháng 1', 'Tháng 2', 'Tháng 3', 'Tháng 4', 'Tháng 5', 'Tháng 6',
    'Tháng 7', 'Tháng 8', 'Tháng 9', 'Tháng 10', 'Tháng 11', 'Tháng 12'
  ];

  const getDaysInMonth = (year: number, month: number) => {
    return new Date(year, month + 1, 0).getDate();
  };

  const daysInMonth = getDaysInMonth(currentDate.getFullYear(), currentDate.getMonth());
  const daysArray = Array.from({ length: daysInMonth }, (_, i) => i + 1);

  const getLeavesForDay = (day: number) => {
    const checkDateStr = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const checkDate = new Date(checkDateStr);
    
    return teamLeaves.filter(leave => {
      const start = new Date(leave.start_date);
      const end = new Date(leave.end_date);
      return checkDate >= start && checkDate <= end;
    });
  };

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm overflow-hidden animate-in fade-in flex flex-col h-[700px]">
      <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between shrink-0">
        <h3 className="font-bold text-lg text-slate-900 dark:text-slate-100 flex items-center gap-2">
          <CalendarDays size={20} className="text-emerald-500" /> Lịch nghỉ phép Đơn vị
        </h3>
        <div className="flex items-center gap-4">
          <button onClick={prevMonth} className="p-1.5 rounded bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300">
            <ChevronLeft size={16} />
          </button>
          <span className="font-semibold text-slate-800 dark:text-slate-200 min-w-[120px] text-center">
            {monthNames[currentDate.getMonth()]} {currentDate.getFullYear()}
          </span>
          <button onClick={nextMonth} className="p-1.5 rounded bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300">
            <ChevronRight size={16} />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-6 relative">
        {isLoading ? (
          <div className="absolute inset-0 flex items-center justify-center bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm z-10">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600 dark:border-emerald-400"></div>
          </div>
        ) : null}
        
        {(!currentEmployee || (currentEmployee.role !== 'UnitLeader' && currentEmployee.role !== 'AdminUnit')) && (
          <div className="mb-4 p-4 border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/20 rounded-lg flex gap-3 text-blue-700 dark:text-blue-300 text-sm">
            <AlertCircle size={18} className="shrink-0 mt-0.5" />
            <p><strong>Lưu ý:</strong> Theo quy định hệ thống, nhân viên chỉ xem được lịch nghỉ đã duyệt của chính mình. (Cấp quản lý mới xem được lịch của toàn đơn vị).</p>
          </div>
        )}

        <div className="grid grid-cols-7 gap-px bg-slate-200 dark:bg-slate-700 border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden">
          {/* Day of Week Headers */}
          {['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'].map((day, i) => (
            <div key={day} className={`bg-slate-50 dark:bg-slate-800/80 p-2 text-center text-xs font-bold uppercase tracking-wider ${i === 0 || i === 6 ? 'text-rose-500 dark:text-rose-400' : 'text-slate-500 dark:text-slate-400'}`}>
              {day}
            </div>
          ))}

          {/* Empty prefix boxes */}
          {Array.from({ length: new Date(currentDate.getFullYear(), currentDate.getMonth(), 1).getDay() }).map((_, i) => (
            <div key={`empty-${i}`} className="bg-slate-50/50 dark:bg-slate-800/30 p-2 min-h-[100px]" />
          ))}

          {/* Days */}
          {daysArray.map(day => {
            const dateObj = new Date(currentDate.getFullYear(), currentDate.getMonth(), day);
            const isWeekend = dateObj.getDay() === 0 || dateObj.getDay() === 6;
            const isToday = new Date().toDateString() === dateObj.toDateString();
            const leaves = getLeavesForDay(day);

            return (
              <div 
                key={day} 
                className={`bg-white dark:bg-slate-900 p-2 min-h-[100px] flex flex-col gap-1 transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/50 ${isWeekend ? 'bg-slate-50/50 dark:bg-slate-800/20' : ''}`}
              >
                <div className="flex justify-between items-start mb-1">
                  <span className={`text-sm font-semibold w-6 h-6 flex items-center justify-center rounded-full ${
                    isToday ? 'bg-emerald-500 text-white shadow-sm' : 
                    isWeekend ? 'text-rose-400 dark:text-rose-500' : 
                    'text-slate-700 dark:text-slate-300'
                  }`}>
                    {day}
                  </span>
                </div>
                
                <div className="flex-1 space-y-1 overflow-y-auto scrollbar-hide max-h-[80px]">
                  {leaves.map(req => (
                    <div 
                      key={req.id} 
                      className="px-1.5 py-1 bg-emerald-100/50 dark:bg-emerald-900/30 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 rounded-md text-[10px] leading-tight flex items-center gap-1 font-medium truncate"
                      title={`${req.employee_name} (${req.leave_type}) - Lưu ý: ${req.reason || 'Không'}`}
                    >
                      <User size={10} className="shrink-0 opacity-70" />
                      <span className="truncate">{req.employee_name || 'NV ẩn danh'}</span>
                      {req.start_half === 'afternoon' && day === new Date(req.start_date).getDate() && <span className="opacity-70">(Chiều)</span>}
                      {req.end_half === 'morning' && day === new Date(req.end_date).getDate() && <span className="opacity-70">(Sáng)</span>}
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

export default LeaveCalendar;
