import React, { useMemo } from 'react';
import { useTheoreticalShifts } from '../../hooks/useTheoreticalShifts';
import { ScheduledEmployeeDetail, EmployeeDailyScheduleInfo } from '../../types';
import { ChevronLeftIcon, ChevronRightIcon } from '../ui/icons'; 
import Button from './Button';
import { getDateRange, getWeekStartDate } from '../../utils/dateUtils';

type CalendarViewMode = 'month' | 'week' | 'day';

interface ShiftCalendarViewProps {
  viewMode: CalendarViewMode;
  currentDisplayDate: Date;
  onViewModeChange: (mode: CalendarViewMode) => void;
  onDateChange: (newDate: Date) => void;
  selectedEmployeeId: string | null;
  getEmployeeDailyScheduleInfo: (employeeId: string, targetDate: Date) => EmployeeDailyScheduleInfo | null;
  getScheduledEmployeesDetailsOnDate: (targetDate: Date) => ScheduledEmployeeDetail[];
  onDayDoubleClick: (date: Date) => void;
}

const ShiftCalendarView: React.FC<ShiftCalendarViewProps> = ({
  viewMode,
  currentDisplayDate,
  onViewModeChange,
  onDateChange,
  selectedEmployeeId,
  getEmployeeDailyScheduleInfo,
  getScheduledEmployeesDetailsOnDate,
  onDayDoubleClick
}) => {
  const { isLoadingShifts } = useTheoreticalShifts();

  const daysInMonthArray = (year: number, month: number): Date[] => {
    const date = new Date(year, month, 1);
    const days: Date[] = [];
    while (date.getMonth() === month) {
      days.push(new Date(date));
      date.setDate(date.getDate() + 1);
    }
    return days;
  };
  
  const daysInWeekArray = (startDate: Date): Date[] => {
    const days: Date[] = [];
    const current = new Date(startDate);
    for (let i = 0; i < 7; i++) {
        days.push(new Date(current));
        current.setDate(current.getDate() + 1);
    }
    return days;
  };


  const calendarGridCells: (Date | null)[] = useMemo(() => {
    if (viewMode === 'month') {
      const year = currentDisplayDate.getFullYear();
      const month = currentDisplayDate.getMonth();
      const firstDayOfMonth = new Date(year, month, 1);
      const monthDaysArr = daysInMonthArray(year, month);
      
      let startingDayOfWeek = firstDayOfMonth.getDay(); // 0 (Sun) - 6 (Sat)
      // Adjust startingDayOfWeek to be 0 for Monday, 6 for Sunday
      startingDayOfWeek = (startingDayOfWeek === 0) ? 6 : startingDayOfWeek - 1;
      
      const cells: (Date | null)[] = [];
      for (let i = 0; i < startingDayOfWeek; i++) {
        cells.push(null);
      }
      monthDaysArr.forEach(day => cells.push(day));
      while (cells.length % 7 !== 0) {
        cells.push(null);
      }
      return cells;
    } else if (viewMode === 'week') { // week view
      const weekStart = getWeekStartDate(new Date(currentDisplayDate));
      return daysInWeekArray(weekStart);
    }
    return []; // For 'day' view, not used
  }, [currentDisplayDate, viewMode]);

  const weekDayNames = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

  if (isLoadingShifts) {
      return <p className="text-center p-4 dark:text-gray-300">Cargando calendario...</p>;
  }
  
  const cellHeightClass = viewMode === 'month' ? 'h-28 sm:h-32' : 'h-36 sm:h-40';

  return (
    <div className="grid grid-cols-7 gap-px border border-gray-200 dark:border-gray-700 bg-gray-200 dark:bg-gray-700">
        {weekDayNames.map(dayName => (
        <div key={dayName} className="py-2 text-center text-xs font-medium text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-gray-700/50">
            {dayName}
        </div>
        ))}
        {calendarGridCells.map((day, index) => {
        if (!day) {
            return <div key={`empty-${index}`} className={`bg-gray-50 dark:bg-gray-700/30 ${cellHeightClass}`}></div>;
        }
        const isToday = new Date().toDateString() === day.toDateString();
        let cellContent;
        let cellBgColor = isToday ? 'bg-blue-100 dark:bg-blue-800/50' : 'bg-white dark:bg-gray-800';

        if (selectedEmployeeId) {
            const scheduleInfo = getEmployeeDailyScheduleInfo(selectedEmployeeId, day);
            if (scheduleInfo && scheduleInfo.isWorkDay) {
            cellContent = (
                <div 
                className="text-xxs sm:text-xs text-center p-1 rounded h-full flex flex-col justify-center items-center" 
                style={{ backgroundColor: isToday ? undefined : (scheduleInfo.patternColor ? `${scheduleInfo.patternColor}33` : undefined) }} // Lighter for non-today, full for today
                title={scheduleInfo.scheduleText}
                >
                <p className="font-semibold text-gray-800 dark:text-gray-100 truncate" title={scheduleInfo.shiftPatternName}>{scheduleInfo.shiftPatternName || 'Turno'}</p>
                <p className="text-gray-700 dark:text-gray-300">{scheduleInfo.startTime}-{scheduleInfo.endTime}</p>
                {scheduleInfo.hours !== undefined && <p className="text-gray-600 dark:text-gray-400">({scheduleInfo.hours.toFixed(2)}h)</p>}
                </div>
            );
            if (isToday && scheduleInfo.patternColor) { // Special border for today if scheduled
                cellBgColor = `bg-blue-100 dark:bg-blue-800/50 border-2`; // Keep prominent today color
            } else if (!isToday && scheduleInfo.patternColor) {
                cellBgColor = `bg-transparent`; // Let inner div handle color
            }


            } else if (scheduleInfo && !scheduleInfo.isWorkDay) {
            cellContent = <p className="text-xxs sm:text-xs text-gray-500 dark:text-gray-400 italic text-center">Libre</p>;
            } else {
            cellContent = <p className="text-xxs sm:text-xs text-gray-500 dark:text-gray-400 italic text-center">-</p>;
            }
        } else {
            const scheduledEmployees: ScheduledEmployeeDetail[] = getScheduledEmployeesDetailsOnDate(day);
            if (scheduledEmployees.length > 0) {
                const maxVisibleEmployees = 10;
                const visibleEmployees = scheduledEmployees.slice(0, maxVisibleEmployees);
                const hiddenCount = scheduledEmployees.length - visibleEmployees.length;

                cellContent = (
                    <>
                        <div className="flex flex-wrap gap-1 mt-1">
                            {visibleEmployees.map(emp => {
                                const nameParts = emp.employeeName.split(' ');
                                const lastName = nameParts.length > 1 ? nameParts[nameParts.length - 1] : emp.employeeName;
                                
                                return (
                                    <div
                                        key={emp.employeeId}
                                        className="text-xxs px-1 py-0.5 rounded text-white truncate text-center"
                                        style={{ backgroundColor: emp.patternColor || '#A0AEC0' }}
                                        title={`${emp.employeeName} | ${emp.shiftPatternName || 'N/A'} (${emp.startTime || ''}-${emp.endTime || ''})`}
                                    >
                                        {lastName}
                                    </div>
                                );
                            })}
                        </div>
                        {hiddenCount > 0 && (
                            <div className="text-center text-xxs text-gray-500 dark:text-gray-400 mt-1 font-semibold">
                                + {hiddenCount} más...
                            </div>
                        )}
                    </>
                );
            }
        }

        return (
            <div 
                key={day.toISOString()}
                onDoubleClick={() => onDayDoubleClick(day)}
                className={`p-1 ${cellHeightClass} overflow-hidden cursor-pointer transition-colors duration-150 hover:bg-gray-100 dark:hover:bg-gray-900/50 
                            ${cellBgColor} 
                            ${isToday && selectedEmployeeId && getEmployeeDailyScheduleInfo(selectedEmployeeId, day)?.patternColor ? `border-2` : 'border-t'}
                            ${isToday && selectedEmployeeId && getEmployeeDailyScheduleInfo(selectedEmployeeId, day)?.patternColor ? `border-[${getEmployeeDailyScheduleInfo(selectedEmployeeId, day)?.patternColor}]` : 'border-gray-200 dark:border-gray-700'}
                            `}
                style={isToday && selectedEmployeeId && getEmployeeDailyScheduleInfo(selectedEmployeeId, day)?.patternColor ? { borderColor: getEmployeeDailyScheduleInfo(selectedEmployeeId, day)?.patternColor } : {}}
            >
            <div className={`text-xs font-semibold ${isToday ? 'text-blue-600 dark:text-blue-300' : 'text-gray-700 dark:text-gray-200'}`}>
                {day.getDate()}
            </div>
            {cellContent}
            </div>
        );
        })}
    </div>
  );
};

export default ShiftCalendarView;