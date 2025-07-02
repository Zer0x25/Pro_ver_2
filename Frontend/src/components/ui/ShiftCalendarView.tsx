import React, { useMemo } from 'react';
import { useTheoreticalShifts } from '../../hooks/useTheoreticalShifts';
import { ScheduledEmployeeDetail, EmployeeDailyScheduleInfo } from '../../types';
import { ChevronLeftIcon, ChevronRightIcon } from '../ui/icons'; 
import Button from './Button';

type CalendarViewMode = 'month' | 'week' | 'day';

interface ShiftCalendarViewProps {
  viewMode: CalendarViewMode;
  currentDisplayDate: Date;
  onViewModeChange: (mode: CalendarViewMode) => void;
  onDateChange: (newDate: Date) => void;
  selectedEmployeeId: string | null;
  getEmployeeDailyScheduleInfo: (employeeId: string, targetDate: Date) => EmployeeDailyScheduleInfo | null;
  getScheduledEmployeesDetailsOnDate: (targetDate: Date) => ScheduledEmployeeDetail[];
}

// Helper function to get the start of the week (Monday)
const getWeekStartDate = (date: Date): Date => {
  const d = new Date(date);
  const day = d.getDay(); // 0 for Sunday, 1 for Monday, etc.
  // Adjust diff to make Monday the first day (0)
  // If day is Sunday (0), we want to go back 6 days. If day is Monday (1), we go back 0 days.
  const diff = d.getDate() - (day === 0 ? 6 : day - 1);
  return new Date(d.setDate(diff));
};


const ShiftCalendarView: React.FC<ShiftCalendarViewProps> = ({
  viewMode,
  currentDisplayDate,
  onViewModeChange,
  onDateChange,
  selectedEmployeeId,
  getEmployeeDailyScheduleInfo,
  getScheduledEmployeesDetailsOnDate,
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

  const handlePrev = () => {
    if (viewMode === 'month') {
      onDateChange(new Date(currentDisplayDate.getFullYear(), currentDisplayDate.getMonth() - 1, 1));
    } else if (viewMode === 'week') {
      const newWeekStart = new Date(currentDisplayDate);
      newWeekStart.setDate(currentDisplayDate.getDate() - 7);
      onDateChange(getWeekStartDate(newWeekStart));
    } else { // 'day' view
      const newDay = new Date(currentDisplayDate);
      newDay.setDate(currentDisplayDate.getDate() - 1);
      onDateChange(newDay);
    }
  };

  const handleNext = () => {
    if (viewMode === 'month') {
      onDateChange(new Date(currentDisplayDate.getFullYear(), currentDisplayDate.getMonth() + 1, 1));
    } else if (viewMode === 'week') {
      const newWeekStart = new Date(currentDisplayDate);
      newWeekStart.setDate(currentDisplayDate.getDate() + 7);
      onDateChange(getWeekStartDate(newWeekStart));
    } else { // 'day' view
      const newDay = new Date(currentDisplayDate);
      newDay.setDate(currentDisplayDate.getDate() + 1);
      onDateChange(newDay);
    }
  };

  const handleToday = () => {
    onDateChange(new Date());
  };
  
  const headerDisplay = useMemo(() => {
    if (viewMode === 'month') {
      return currentDisplayDate.toLocaleDateString('es-CL', { month: 'long', year: 'numeric' });
    } else if (viewMode === 'week') {
      const weekStart = getWeekStartDate(new Date(currentDisplayDate));
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekStart.getDate() + 6);
      return `Semana: ${weekStart.toLocaleDateString('es-CL', {day: '2-digit', month: '2-digit'})} - ${weekEnd.toLocaleDateString('es-CL', {day: '2-digit', month: '2-digit', year: 'numeric'})}`;
    } else { // 'day' view
      return currentDisplayDate.toLocaleDateString('es-CL', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    }
  }, [currentDisplayDate, viewMode]);

  if (isLoadingShifts) {
      return <p className="text-center p-4 dark:text-gray-300">Cargando calendario...</p>;
  }
  
  const cellHeightClass = viewMode === 'month' ? 'h-28 sm:h-32' : 'h-36 sm:h-40';
  
  const renderDayView = () => {
    if (selectedEmployeeId) {
        const scheduleInfo = getEmployeeDailyScheduleInfo(selectedEmployeeId, currentDisplayDate);
        if (!scheduleInfo) return <div className="p-4 text-center dark:text-gray-300">No hay datos de turno para este empleado en esta fecha.</div>;
        
        return (
            <div className="p-4">
                <h4 className="text-lg font-semibold text-center mb-4 text-gray-800 dark:text-gray-100">{scheduleInfo.isWorkDay ? "Turno Programado" : "Día Libre"}</h4>
                {scheduleInfo.isWorkDay ? (
                    <div className="text-center">
                        <p className="text-2xl font-bold" style={{ color: scheduleInfo.patternColor || '#333' }}>
                            {scheduleInfo.startTime} - {scheduleInfo.endTime}
                        </p>
                        <p className="text-gray-600 dark:text-gray-400">({scheduleInfo.hours?.toFixed(2)} hrs)</p>
                        <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">Patrón: <span className="font-semibold">{scheduleInfo.shiftPatternName}</span></p>
                    </div>
                ) : (
                     <p className="text-center text-gray-500 dark:text-gray-400">El empleado tiene el día libre.</p>
                )}
            </div>
        );
    }

    const scheduledEmployees = getScheduledEmployeesDetailsOnDate(currentDisplayDate);

    if (scheduledEmployees.length === 0) {
        return <div className="p-4 text-center text-gray-500 dark:text-gray-400">No hay empleados programados para este día en el grupo seleccionado.</div>;
    }

    return (
        <div className="p-2 space-y-2">
            <h4 className="text-md font-semibold text-gray-700 dark:text-gray-300 px-2">Empleados Programados:</h4>
            <ul className="divide-y divide-gray-200 dark:divide-gray-700 max-h-[60vh] overflow-y-auto">
                {scheduledEmployees.map(emp => (
                    <li key={emp.employeeId} className="p-3 flex justify-between items-center" style={{ borderLeft: `4px solid ${emp.patternColor || '#ccc'}`}}>
                        <div>
                            <p className="font-semibold text-gray-800 dark:text-gray-100">{emp.employeeName}</p>
                            <p className="text-sm text-gray-600 dark:text-gray-400">{emp.shiftPatternName}</p>
                        </div>
                        <div className="text-right">
                            <p className="font-mono text-gray-800 dark:text-gray-100">{emp.startTime} - {emp.endTime}</p>
                        </div>
                    </li>
                ))}
            </ul>
        </div>
    );
  };

  return (
    <div className="p-4 bg-white dark:bg-gray-800 rounded-lg shadow">
      <div className="flex flex-col sm:flex-row justify-between items-center mb-4 gap-4">
        <div className="flex items-center space-x-2">
          <div className="flex space-x-1 border-r border-gray-300 dark:border-gray-600 pr-2">
            <Button onClick={() => onViewModeChange('month')} variant={viewMode === 'month' ? 'primary' : 'secondary'} size="sm">Mes</Button>
            <Button onClick={() => onViewModeChange('week')} variant={viewMode === 'week' ? 'primary' : 'secondary'} size="sm">Semana</Button>
            <Button onClick={() => onViewModeChange('day')} variant={viewMode === 'day' ? 'primary' : 'secondary'} size="sm">Día</Button>
          </div>
          <Button onClick={handleToday} variant="secondary" size="sm">Actual</Button>
          <div className="flex items-center">
            <Button onClick={handlePrev} size="sm" aria-label="Anterior" className="p-1.5 rounded-l-md rounded-r-none border-r-0">
              <ChevronLeftIcon className="w-5 h-5"/>
            </Button>
            <Button onClick={handleNext} size="sm" aria-label="Siguiente" className="p-1.5 rounded-r-md rounded-l-none">
              <ChevronRightIcon className="w-5 h-5"/>
            </Button>
          </div>
        </div>

        <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100 capitalize text-center sm:text-right">
          {headerDisplay}
        </h3>
      </div>

      {viewMode === 'day' ? (
        renderDayView()
      ) : (
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
                    const gridColsClass = viewMode === 'month' ? 'grid-cols-3' : 'grid-cols-4';
                    const maxItems = viewMode === 'month' ? 8 : 15;

                    cellContent = (
                        <div className={`grid ${gridColsClass} gap-1 mt-1 place-items-center`}>
                            {scheduledEmployees.slice(0, maxItems).map(emp => {
                                const nameParts = emp.employeeName.split(' ');
                                const initials = ((nameParts[0]?.[0] || '') + (nameParts.length > 1 ? nameParts[nameParts.length - 1]?.[0] || '' : '')).toUpperCase();
                                
                                return (
                                    <div 
                                        key={emp.employeeId} 
                                        className="w-6 h-6 rounded-full flex items-center justify-center text-white font-bold text-xxs shadow-sm"
                                        style={{ backgroundColor: emp.patternColor || '#A0AEC0' }}
                                        title={`${emp.employeeName} | ${emp.shiftPatternName || 'N/A'} (${emp.startTime || ''}-${emp.endTime || ''})`}
                                    >
                                        {initials}
                                    </div>
                                );
                            })}
                            {scheduledEmployees.length > maxItems && (
                                <div 
                                    className="w-6 h-6 rounded-full flex items-center justify-center text-xxs font-semibold bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-200"
                                    title={`${scheduledEmployees.length - maxItems} más empleados`}
                                >
                                    +{scheduledEmployees.length - maxItems}
                                </div>
                            )}
                        </div>
                    );
                }
            }

            return (
                <div 
                    key={day.toISOString()}
                    onDoubleClick={() => {
                        onViewModeChange('day');
                        onDateChange(day);
                    }}
                    className={`p-1 ${cellHeightClass} overflow-y-auto cursor-pointer transition-colors duration-150 hover:bg-gray-100 dark:hover:bg-gray-900/50 
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
      )}
    </div>
  );
};

// Add some basic styling for text-xxs if not available in Tailwind config
// This should ideally be in a global CSS or a more permanent solution if not using Tailwind JIT/AOT for this.
if (!document.getElementById('custom-text-xxs-style')) {
    const style = document.createElement('style');
    style.id = 'custom-text-xxs-style';
    style.innerHTML = `
      .text-xxs {
        font-size: 0.65rem; /* Adjust as needed */
        line-height: 0.85rem; /* Adjust as needed */
      }
    `;
    document.head.appendChild(style);
}

export default ShiftCalendarView;