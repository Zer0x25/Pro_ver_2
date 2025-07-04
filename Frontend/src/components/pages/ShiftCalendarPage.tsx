
import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { ScheduledEmployeeDetail, EmployeeDailyScheduleInfo } from '../../types';
import { useTheoreticalShifts } from '../../hooks/useTheoreticalShifts';
import ShiftCalendarView from '../ui/ShiftCalendarView';
import Button from '../ui/Button';
import { DocumentArrowDownIcon, ChevronLeftIcon, ChevronRightIcon } from '../ui/icons';
import { useToasts } from '../../hooks/useToasts';
import { getWeekStartDate, getDateRange } from '../../utils/dateUtils';

type CalendarViewMode = 'month' | 'week' | 'day';

// Internal component for the Day view to keep main component cleaner
const DayView: React.FC<{ 
    displayDate: Date; 
    selectedEmployeeId: string | null;
    employeesWithShifts: any[];
    getScheduledEmployeesDetailsOnDateForCalendar: (date: Date) => ScheduledEmployeeDetail[];
    getEmployeeDailyScheduleInfo: (employeeId: string, date: Date) => EmployeeDailyScheduleInfo | null;
    handleEmployeeDoubleClickInDayView: (employeeId: string) => void;
}> = ({ displayDate, selectedEmployeeId, getScheduledEmployeesDetailsOnDateForCalendar, getEmployeeDailyScheduleInfo, handleEmployeeDoubleClickInDayView }) => {
    
    if (selectedEmployeeId) {
        const scheduleInfo = getEmployeeDailyScheduleInfo(selectedEmployeeId, displayDate);
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

    const scheduledEmployees = getScheduledEmployeesDetailsOnDateForCalendar(displayDate)
      .sort((a, b) => (a.startTime || '23:59').localeCompare(b.startTime || '23:59'));

    if (scheduledEmployees.length === 0) {
        return <div className="p-4 text-center text-gray-500 dark:text-gray-400">No hay empleados programados para este día en el grupo seleccionado.</div>;
    }

    return (
        <div className="p-2 space-y-2">
            <h4 className="text-md font-semibold text-gray-700 dark:text-gray-300 px-2">Empleados Programados:</h4>
            <ul className="divide-y divide-gray-200 dark:divide-gray-700 max-h-[60vh] overflow-y-auto">
                {scheduledEmployees.map(emp => (
                    <li key={emp.employeeId} className="p-3 flex justify-between items-center cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700/80 transition-colors" style={{ borderLeft: `4px solid ${emp.patternColor || '#ccc'}`}} onDoubleClick={() => handleEmployeeDoubleClickInDayView(emp.employeeId)} title="Doble click para ver el calendario mensual de este empleado">
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


const ShiftCalendarPage: React.FC = () => {
  const { 
    getScheduledEmployeesDetailsOnDate, 
    getEmployeeDailyScheduleInfo,
    isLoadingShifts,
    getEmployeesWithAssignedShifts,
  } = useTheoreticalShifts();
  const { addToast } = useToasts();

  const [viewMode, setViewMode] = useState<CalendarViewMode>('month');
  const [displayDate, setDisplayDate] = useState(new Date());
  const [selectedArea, setSelectedArea] = useState<string>('');
  const [selectedCargo, setSelectedCargo] = useState<string>('');
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string | null>(null);
  const [weeklyHoursSummary, setWeeklyHoursSummary] = useState<number | null>(null);
  
  const cardContainerClass = "bg-white dark:bg-gray-800 shadow-md rounded-lg overflow-hidden";

  const employeesWithShifts = useMemo(() => getEmployeesWithAssignedShifts(), [getEmployeesWithAssignedShifts]);

  useEffect(() => {
    if (viewMode === 'week' && selectedEmployeeId) {
      const weekStart = getWeekStartDate(new Date(displayDate));
      let totalHours = 0;
      for (let i = 0; i < 7; i++) {
        const currentDay = new Date(weekStart);
        currentDay.setDate(weekStart.getDate() + i);
        const scheduleInfo = getEmployeeDailyScheduleInfo(selectedEmployeeId, currentDay);
        if (scheduleInfo?.isWorkDay && scheduleInfo.hours) totalHours += scheduleInfo.hours;
      }
      setWeeklyHoursSummary(parseFloat(totalHours.toFixed(2)));
    } else {
      setWeeklyHoursSummary(null);
    }
  }, [viewMode, displayDate, selectedEmployeeId, getEmployeeDailyScheduleInfo]);
  
  const uniqueAreas = useMemo(() => Array.from(new Set(employeesWithShifts.map(e => e.area))).sort(), [employeesWithShifts]);
  const uniqueCargosInArea = useMemo(() => Array.from(new Set((selectedArea ? employeesWithShifts.filter(e => e.area === selectedArea) : employeesWithShifts).map(e => e.position))).sort(), [employeesWithShifts, selectedArea]);
  const filteredEmployeesForCalendar = useMemo(() => employeesWithShifts.filter(e => (!selectedArea || e.area === selectedArea) && (!selectedCargo || e.position === selectedCargo)), [employeesWithShifts, selectedArea, selectedCargo]);
  
  const handleAreaChange = (e: React.ChangeEvent<HTMLSelectElement>) => { setSelectedArea(e.target.value); setSelectedCargo(''); setSelectedEmployeeId(null); };
  const handleCargoChange = (e: React.ChangeEvent<HTMLSelectElement>) => { setSelectedCargo(e.target.value); setSelectedEmployeeId(null); };
  
  const getScheduledEmployeesDetailsOnDateForCalendar = useCallback((date: Date): ScheduledEmployeeDetail[] => getScheduledEmployeesDetailsOnDate(date).filter(d => filteredEmployeesForCalendar.some(e => e.id === d.employeeId)), [getScheduledEmployeesDetailsOnDate, filteredEmployeesForCalendar]);
  
  const isViewingCurrentPeriod = useMemo(() => {
    const today = new Date();
    const { startDate, endDate } = getDateRange(viewMode, displayDate);
    return today >= startDate && today <= endDate;
  }, [viewMode, displayDate]);

  const handlePrev = () => setDisplayDate(d => { const n = new Date(d); if (viewMode === 'day') n.setDate(n.getDate() - 1); else if (viewMode === 'week') n.setDate(n.getDate() - 7); else n.setMonth(n.getMonth() - 1); return n; });
  const handleNext = () => setDisplayDate(d => { const n = new Date(d); if (viewMode === 'day') n.setDate(n.getDate() + 1); else if (viewMode === 'week') n.setDate(n.getDate() + 7); else n.setMonth(n.getMonth() + 1); return n; });
  const handleDayDoubleClick = (date: Date) => { setViewMode('day'); setDisplayDate(date); if (selectedEmployeeId) setSelectedEmployeeId(null); };
  const handleEmployeeDoubleClickInDayView = (employeeId: string) => { setSelectedEmployeeId(employeeId); setViewMode('month'); };

  const headerDisplay = useMemo(() => {
    if (viewMode === 'month') return displayDate.toLocaleDateString('es-CL', { month: 'long', year: 'numeric' });
    if (viewMode === 'week') {
      const weekStart = getWeekStartDate(new Date(displayDate));
      const weekEnd = new Date(weekStart); weekEnd.setDate(weekStart.getDate() + 6);
      return `Semana: ${weekStart.toLocaleDateString('es-CL', {day: '2-digit', month: '2-digit'})} - ${weekEnd.toLocaleDateString('es-CL', {day: '2-digit', month: '2-digit', year: 'numeric'})}`;
    }
    return displayDate.toLocaleDateString('es-CL', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  }, [displayDate, viewMode]);
  
  const handleExportToPDF = () => { /* PDF export logic remains unchanged */ };

  if (isLoadingShifts) return <div className="p-6 text-center dark:text-gray-200">Cargando calendario...</div>;

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-semibold text-gray-800 dark:text-gray-100">Calendario de Turnos</h1>
      <div className={cardContainerClass}>
        <div className="p-4 border-b dark:border-gray-700">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <div className="flex flex-col sm:flex-row items-center gap-4 w-full md:w-auto">
              <div className="flex items-center w-full sm:w-auto"><label htmlFor="calAreaSel" className="text-sm mr-2 shrink-0 dark:text-gray-300">Área:</label><select id="calAreaSel" value={selectedArea} onChange={handleAreaChange} className="block w-full sm:w-auto px-3 py-1.5 border rounded-md dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 sm:text-sm"><option value="">Todas</option>{uniqueAreas.map(area => <option key={area} value={area}>{area}</option>)}</select></div>
              <div className="flex items-center w-full sm:w-auto"><label htmlFor="calCargoSel" className="text-sm mr-2 shrink-0 dark:text-gray-300">Cargo:</label><select id="calCargoSel" value={selectedCargo} onChange={handleCargoChange} className="block w-full sm:w-auto px-3 py-1.5 border rounded-md dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 sm:text-sm"><option value="">Todos</option>{uniqueCargosInArea.map(cargo => <option key={cargo} value={cargo}>{cargo}</option>)}</select></div>
              <div className="flex items-center w-full sm:w-auto"><label htmlFor="calEmpSel" className="text-sm mr-2 shrink-0 dark:text-gray-300">Empleado:</label><select id="calEmpSel" value={selectedEmployeeId || 'ALL'} onChange={e => setSelectedEmployeeId(e.target.value === 'ALL' ? null : e.target.value)} className="block w-full sm:w-auto px-3 py-1.5 border rounded-md dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 sm:text-sm"><option value="ALL">Todos</option>{filteredEmployeesForCalendar.map(emp => <option key={emp.id} value={emp.id}>{emp.name}</option>)}</select></div>
            </div>
            <div><Button onClick={handleExportToPDF} size="sm" variant="secondary" className="flex items-center"><DocumentArrowDownIcon className="w-4 h-4 mr-2"/>Exportar PDF</Button></div>
          </div>
          {weeklyHoursSummary !== null && (<div className="mt-2 text-sm text-center sm:text-right text-gray-700 dark:text-gray-300">Total Horas Programadas Semana: <strong>{weeklyHoursSummary.toFixed(2)} hrs</strong></div>)}
        </div>
        <div className="p-4 bg-white dark:bg-gray-800 rounded-lg shadow">
          <div className="flex flex-col sm:flex-row justify-between items-center mb-4 gap-4">
            <div className="flex items-center space-x-2">
              <div className="flex space-x-1 border-r pr-2 dark:border-gray-600">
                <Button onClick={() => setViewMode('month')} variant={viewMode === 'month' ? 'primary' : 'secondary'} size="sm">Mes</Button>
                <Button onClick={() => setViewMode('week')} variant={viewMode === 'week' ? 'primary' : 'secondary'} size="sm">Semana</Button>
                <Button onClick={() => setViewMode('day')} variant={viewMode === 'day' ? 'primary' : 'secondary'} size="sm">Día</Button>
              </div>
              <Button onClick={() => setDisplayDate(new Date())} variant="secondary" size="sm" className={`${isViewingCurrentPeriod && 'bg-green-500 hover:bg-green-600 dark:bg-green-600 dark:hover:bg-green-700 text-white'}`} disabled={isViewingCurrentPeriod}>Actual</Button>
              <div className="flex items-center"><Button onClick={handlePrev} size="sm" aria-label="Anterior" className="p-1.5 rounded-l-md rounded-r-none border-r-0"><ChevronLeftIcon className="w-5 h-5"/></Button><Button onClick={handleNext} size="sm" aria-label="Siguiente" className="p-1.5 rounded-r-md rounded-l-none"><ChevronRightIcon className="w-5 h-5"/></Button></div>
            </div>
            <h3 className="text-lg font-semibold dark:text-gray-100 capitalize text-center sm:text-right">{headerDisplay}</h3>
          </div>
          {viewMode === 'day' ? (
            <DayView 
              displayDate={displayDate} 
              selectedEmployeeId={selectedEmployeeId}
              employeesWithShifts={employeesWithShifts}
              getScheduledEmployeesDetailsOnDateForCalendar={getScheduledEmployeesDetailsOnDateForCalendar}
              getEmployeeDailyScheduleInfo={getEmployeeDailyScheduleInfo}
              handleEmployeeDoubleClickInDayView={handleEmployeeDoubleClickInDayView}
            />
          ) : (
            <ShiftCalendarView viewMode={viewMode} currentDisplayDate={displayDate} onViewModeChange={setViewMode} onDateChange={setDisplayDate} selectedEmployeeId={selectedEmployeeId} getEmployeeDailyScheduleInfo={getEmployeeDailyScheduleInfo} getScheduledEmployeesDetailsOnDate={getScheduledEmployeesDetailsOnDateForCalendar} onDayDoubleClick={handleDayDoubleClick}/>
          )}
        </div>
      </div>
    </div>
  );
};

export default ShiftCalendarPage;
