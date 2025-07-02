import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { ScheduledEmployeeDetail, EmployeeDailyScheduleInfo } from '../../types';
import { useTheoreticalShifts } from '../../hooks/useTheoreticalShifts';
import { useEmployees } from '../../contexts/EmployeeContext';
import ShiftCalendarView from '../ui/ShiftCalendarView';
import Button from '../ui/Button';
import { DocumentArrowDownIcon } from '../ui/icons';
import { useToasts } from '../../hooks/useToasts';

type CalendarViewMode = 'month' | 'week' | 'day';

// Helper to get week start date (Monday)
const getWeekStartDate = (date: Date): Date => {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - (day === 0 ? 6 : day - 1);
  return new Date(d.setDate(diff));
};

const ShiftCalendarPage: React.FC = () => {
  const { 
    getScheduledEmployeesDetailsOnDate, 
    getEmployeeDailyScheduleInfo,
    isLoadingShifts,
  } = useTheoreticalShifts();
  const { activeEmployees, isLoadingEmployees } = useEmployees();
  const { addToast } = useToasts();

  // Calendar State
  const [calendarViewMode, setCalendarViewMode] = useState<CalendarViewMode>('month');
  const [calendarDisplayDate, setCalendarDisplayDate] = useState(new Date());
  const [selectedCalendarArea, setSelectedCalendarArea] = useState<string>('');
  const [selectedCalendarCargo, setSelectedCalendarCargo] = useState<string>('');
  const [selectedCalendarEmployeeId, setSelectedCalendarEmployeeId] = useState<string | null>(null);
  const [weeklyHoursSummary, setWeeklyHoursSummary] = useState<number | null>(null);
  
  const cardContainerClass = "bg-white dark:bg-gray-800 shadow-md rounded-lg overflow-hidden";

  useEffect(() => {
    if (calendarViewMode === 'week' && selectedCalendarEmployeeId) {
      const weekStart = getWeekStartDate(new Date(calendarDisplayDate));
      let totalHours = 0;
      for (let i = 0; i < 7; i++) {
        const currentDay = new Date(weekStart);
        currentDay.setDate(weekStart.getDate() + i);
        const scheduleInfo = getEmployeeDailyScheduleInfo(selectedCalendarEmployeeId, currentDay);
        if (scheduleInfo && scheduleInfo.isWorkDay && scheduleInfo.hours) {
          totalHours += scheduleInfo.hours;
        }
      }
      setWeeklyHoursSummary(parseFloat(totalHours.toFixed(2)));
    } else {
      setWeeklyHoursSummary(null);
    }
  }, [calendarViewMode, calendarDisplayDate, selectedCalendarEmployeeId, getEmployeeDailyScheduleInfo]);
  
  const uniqueAreas = useMemo(() => {
    const areas = new Set(activeEmployees.map(emp => emp.area));
    return Array.from(areas).sort();
  }, [activeEmployees]);
  
  const uniqueCargosInArea = useMemo(() => {
    let employeesToFilter = activeEmployees;
    if (selectedCalendarArea) {
      employeesToFilter = activeEmployees.filter(emp => emp.area === selectedCalendarArea);
    }
    const cargos = new Set(employeesToFilter.map(emp => emp.position));
    return Array.from(cargos).sort();
  }, [activeEmployees, selectedCalendarArea]);


  const filteredEmployeesForCalendar = useMemo(() => {
    return activeEmployees.filter(emp => {
      const areaMatch = !selectedCalendarArea || emp.area === selectedCalendarArea;
      const cargoMatch = !selectedCalendarCargo || emp.position === selectedCalendarCargo;
      return areaMatch && cargoMatch;
    });
  }, [activeEmployees, selectedCalendarArea, selectedCalendarCargo]);

  // Handle cascading filter resets
  const handleAreaChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedCalendarArea(e.target.value);
    setSelectedCalendarCargo(''); // Reset cargo on area change
    setSelectedCalendarEmployeeId(null); // Reset employee on area change
  };

  const handleCargoChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedCalendarCargo(e.target.value);
    setSelectedCalendarEmployeeId(null); // Reset employee on cargo change
  };
  
  const getScheduledEmployeesDetailsOnDateForCalendar = useCallback((targetDate: Date): ScheduledEmployeeDetail[] => {
      const allScheduled = getScheduledEmployeesDetailsOnDate(targetDate);
      const employeesToDisplay = new Set(filteredEmployeesForCalendar.map(e => e.id));
      return allScheduled.filter(detail => employeesToDisplay.has(detail.employeeId));
  }, [getScheduledEmployeesDetailsOnDate, filteredEmployeesForCalendar]);
  
  const handleExportToPDF = () => {
    const headerDisplay = (() => {
      if (calendarViewMode === 'month') {
        return calendarDisplayDate.toLocaleDateString('es-CL', { month: 'long', year: 'numeric' });
      } else if (calendarViewMode === 'week') {
        const weekStart = getWeekStartDate(new Date(calendarDisplayDate));
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekStart.getDate() + 6);
        return `Semana: ${weekStart.toLocaleDateString('es-CL', {day: '2-digit', month: '2-digit'})} - ${weekEnd.toLocaleDateString('es-CL', {day: '2-digit', month: '2-digit', year: 'numeric'})}`;
      } else {
        return calendarDisplayDate.toLocaleDateString('es-CL', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
      }
    })();
  
    const selectedAreaName = selectedCalendarArea || 'Todas';
    const selectedCargoName = selectedCalendarCargo || 'Todos';
    let selectedEmployeeName = 'Todos';
    if (selectedCalendarEmployeeId) {
      const emp = activeEmployees.find(e => e.id === selectedCalendarEmployeeId);
      if (emp) selectedEmployeeName = emp.name;
    }
  
    const filtersApplied = `Área: ${selectedAreaName}, Cargo: ${selectedCargoName}, Empleado: ${selectedEmployeeName}`;
    
    let contentHtml = '';
  
    const escapeHtml = (unsafe: string) => 
        unsafe
             .replace(/&/g, "&amp;")
             .replace(/</g, "&lt;")
             .replace(/>/g, "&gt;")
             .replace(/"/g, "&quot;")
             .replace(/'/g, "&#039;");

    if (calendarViewMode === 'day') {
      if (selectedCalendarEmployeeId) {
          const scheduleInfo = getEmployeeDailyScheduleInfo(selectedCalendarEmployeeId, calendarDisplayDate);
          if (!scheduleInfo) {
              contentHtml = '<p>No hay datos de turno para este empleado en esta fecha.</p>';
          } else {
              contentHtml = `
                <h2>${escapeHtml(scheduleInfo.isWorkDay ? "Turno Programado" : "Día Libre")}</h2>
                ${scheduleInfo.isWorkDay ? `
                  <div class="schedule-details">
                      <p><strong>Horario:</strong> ${escapeHtml(scheduleInfo.startTime || '')} - ${escapeHtml(scheduleInfo.endTime || '')} (${scheduleInfo.hours?.toFixed(2)} hrs)</p>
                      <p><strong>Patrón:</strong> ${escapeHtml(scheduleInfo.shiftPatternName || '')}</p>
                  </div>
                ` : '<p>El empleado tiene el día libre.</p>'}
              `;
          }
      } else {
          const scheduledEmployees = getScheduledEmployeesDetailsOnDateForCalendar(calendarDisplayDate);
          if (scheduledEmployees.length === 0) {
              contentHtml = '<p>No hay empleados programados para este día.</p>';
          } else {
              const employeeRows = scheduledEmployees.map(emp => `
                  <tr>
                      <td>${escapeHtml(emp.employeeName)}</td>
                      <td>${escapeHtml(emp.shiftPatternName)}</td>
                      <td>${escapeHtml(emp.startTime || '')} - ${escapeHtml(emp.endTime || '')}</td>
                  </tr>
              `).join('');
              contentHtml = `
                <table>
                  <thead>
                    <tr>
                      <th>Empleado</th>
                      <th>Patrón</th>
                      <th>Horario</th>
                    </tr>
                  </thead>
                  <tbody>${employeeRows}</tbody>
                </table>
              `;
          }
      }
    } else { // month or week view
      const daysToRender: (Date|null)[] = [];
      if (calendarViewMode === 'month') {
          const year = calendarDisplayDate.getFullYear();
          const month = calendarDisplayDate.getMonth();
          const firstDayOfMonth = new Date(year, month, 1);
          let startingDayOfWeek = firstDayOfMonth.getDay();
          startingDayOfWeek = (startingDayOfWeek === 0) ? 6 : startingDayOfWeek - 1;
  
          for (let i = 0; i < startingDayOfWeek; i++) daysToRender.push(null);
          
          const date = new Date(year, month, 1);
          while(date.getMonth() === month) {
              daysToRender.push(new Date(date));
              date.setDate(date.getDate() + 1);
          }
          while (daysToRender.length % 7 !== 0) daysToRender.push(null);
      } else {
          const weekStart = getWeekStartDate(new Date(calendarDisplayDate));
          for (let i = 0; i < 7; i++) {
              const current = new Date(weekStart);
              current.setDate(weekStart.getDate() + i);
              daysToRender.push(current);
          }
      }
  
      const weekDayNames = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
      const tableHeader = `<thead><tr>${weekDayNames.map(d => `<th>${d}</th>`).join('')}</tr></thead>`;
      
      let tableBodyCells = '';
      daysToRender.forEach((day, index) => {
          if (index % 7 === 0) tableBodyCells += '<tr>';
  
          if (!day) {
              tableBodyCells += '<td class="empty"></td>';
          } else {
              let cellContent = '';
              if (selectedCalendarEmployeeId) {
                  const scheduleInfo = getEmployeeDailyScheduleInfo(selectedCalendarEmployeeId, day);
                  if (scheduleInfo && scheduleInfo.isWorkDay) {
                      cellContent = `
                          <div class="schedule-entry" style="border-left-color: ${escapeHtml(scheduleInfo.patternColor || '#ccc')}">
                              <strong>${escapeHtml(scheduleInfo.shiftPatternName || '')}</strong><br>
                              <span>${escapeHtml(scheduleInfo.startTime || '')}-${escapeHtml(scheduleInfo.endTime || '')}</span><br>
                              <span>(${scheduleInfo.hours?.toFixed(2)}h)</span>
                          </div>
                      `;
                  } else if (scheduleInfo) {
                      cellContent = `<div class="day-off">Libre</div>`;
                  }
              } else {
                  const scheduledEmployees = getScheduledEmployeesDetailsOnDateForCalendar(day);
                  if (scheduledEmployees.length > 0) {
                      cellContent = scheduledEmployees.map(emp => `
                          <div class="employee-entry" style="background-color: ${emp.patternColor ? escapeHtml(emp.patternColor) + '33' : '#eee'}">
                              ${escapeHtml(emp.employeeName.split(' ')[0])}
                          </div>
                      `).join('');
                  }
              }
              tableBodyCells += `<td><div class="day-number">${day.getDate()}</div><div class="cell-content">${cellContent}</div></td>`;
          }
  
          if ((index + 1) % 7 === 0) tableBodyCells += '</tr>';
      });
  
      contentHtml = `<table>${tableHeader}<tbody>${tableBodyCells}</tbody></table>`;
    }
    
    const htmlToPrint = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Reporte de Calendario de Turnos</title>
        <style>
          @media print {
            @page { size: A4 landscape; margin: 15px; }
            body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          }
          body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif; font-size: 10px; }
          h1 { text-align: center; color: #005792; font-size: 1.5em; }
          p { margin: 2px 0; }
          .info-header { margin-bottom: 10px; padding-bottom: 5px; border-bottom: 1px solid #ccc; }
          table { width: 100%; border-collapse: collapse; }
          th, td { border: 1px solid #ccc; padding: 4px; text-align: left; vertical-align: top; }
          th { background-color: #f0f2f5; font-weight: 600; }
          td.empty { background-color: #f9f9f9; }
          .day-number { font-weight: bold; margin-bottom: 2px; }
          .cell-content { min-height: 50px; }
          .schedule-entry { border-left: 3px solid; padding-left: 4px; margin-bottom: 2px; }
          .employee-entry { font-size: 9px; padding: 1px 3px; border-radius: 3px; margin-bottom: 2px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
          .day-off { color: #888; font-style: italic; }
          h2 { font-size: 1.2em; text-align: center; margin-bottom: 10px; }
          .schedule-details { padding: 10px; border: 1px solid #eee; border-radius: 5px; background: #f9f9f9; text-align: center; }
        </style>
      </head>
      <body>
        <h1>Reporte de Calendario de Turnos</h1>
        <div class="info-header">
          <p><strong>Reporte para:</strong> ${escapeHtml(headerDisplay)}</p>
          <p><strong>Filtros Aplicados:</strong> ${escapeHtml(filtersApplied)}</p>
          <p><strong>Fecha de Exportación:</strong> ${new Date().toLocaleString('es-CL')}</p>
        </div>
        ${contentHtml}
      </body>
      </html>
    `;
    
    const printWindow = window.open('', '_blank');
    if (printWindow) {
        printWindow.document.write(htmlToPrint);
        printWindow.document.close();
        printWindow.focus();
        setTimeout(() => {
            try {
                printWindow.print();
                printWindow.onafterprint = () => printWindow.close();
            } catch (e) {
                console.error("Error al imprimir:", e);
                addToast("Error al abrir la ventana de impresión.", "error");
                printWindow.close();
            }
        }, 500);
        addToast("Preparando PDF para impresión...", "info");
    } else {
        addToast("No se pudo abrir la ventana de impresión. Verifique los bloqueadores de pop-ups.", "warning");
    }
  };

  if (isLoadingShifts || isLoadingEmployees) {
    return <div className="p-6 text-center dark:text-gray-200">Cargando calendario...</div>;
  }

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-semibold text-gray-800 dark:text-gray-100">Calendario de Turnos</h1>
      <div className={cardContainerClass}>
          <div className="p-4 border-b dark:border-gray-700">
              <div className="flex flex-col md:flex-row justify-between items-center gap-4">
                  <div className="flex flex-col sm:flex-row items-center gap-4 w-full md:w-auto">
                    <div className="flex items-center w-full sm:w-auto">
                      <label htmlFor="calendarAreaSelect" className="text-sm font-medium text-gray-700 dark:text-gray-300 mr-2 shrink-0">Área:</label>
                      <select id="calendarAreaSelect" value={selectedCalendarArea} onChange={handleAreaChange} className="block w-full sm:w-auto px-3 py-1.5 border border-sap-border dark:border-gray-600 rounded-md shadow-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-sap-blue focus:border-sap-blue sm:text-sm">
                        <option value="">Todas las Áreas</option>
                        {uniqueAreas.map(area => <option key={area} value={area}>{area}</option>)}
                      </select>
                    </div>
                    <div className="flex items-center w-full sm:w-auto">
                      <label htmlFor="calendarCargoSelect" className="text-sm font-medium text-gray-700 dark:text-gray-300 mr-2 shrink-0">Cargo:</label>
                      <select id="calendarCargoSelect" value={selectedCalendarCargo} onChange={handleCargoChange} className="block w-full sm:w-auto px-3 py-1.5 border border-sap-border dark:border-gray-600 rounded-md shadow-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-sap-blue focus:border-sap-blue sm:text-sm">
                        <option value="">Todos los Cargos</option>
                        {uniqueCargosInArea.map(cargo => <option key={cargo} value={cargo}>{cargo}</option>)}
                      </select>
                    </div>
                    <div className="flex items-center w-full sm:w-auto">
                        <label htmlFor="calendarEmployeeSelect" className="text-sm font-medium text-gray-700 dark:text-gray-300 mr-2 shrink-0">Empleado:</label>
                        <select id="calendarEmployeeSelect" value={selectedCalendarEmployeeId || 'ALL'} onChange={e => setSelectedCalendarEmployeeId(e.target.value === 'ALL' ? null : e.target.value)} className="block w-full sm:w-auto px-3 py-1.5 border border-sap-border dark:border-gray-600 rounded-md shadow-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-sap-blue focus:border-sap-blue sm:text-sm">
                            <option value="ALL">Todos los Empleados</option>
                            {filteredEmployeesForCalendar.map(emp => <option key={emp.id} value={emp.id}>{emp.name}</option>)}
                        </select>
                    </div>
                  </div>
                   <Button onClick={handleExportToPDF} variant="secondary" size="sm" className="flex items-center shrink-0 w-full md:w-auto">
                      <DocumentArrowDownIcon className="w-4 h-4 mr-2" />
                      Exportar a PDF
                  </Button>
              </div>
                {weeklyHoursSummary !== null && (<div className="mt-2 text-sm text-center sm:text-right text-gray-700 dark:text-gray-300">Total Horas Programadas para la Semana Seleccionada: <strong>{weeklyHoursSummary.toFixed(2)} hrs</strong></div>)}
          </div>
          <ShiftCalendarView 
              viewMode={calendarViewMode} 
              currentDisplayDate={calendarDisplayDate} 
              onViewModeChange={setCalendarViewMode} 
              onDateChange={setCalendarDisplayDate} 
              selectedEmployeeId={selectedCalendarEmployeeId} 
              getEmployeeDailyScheduleInfo={getEmployeeDailyScheduleInfo} 
              getScheduledEmployeesDetailsOnDate={getScheduledEmployeesDetailsOnDateForCalendar} 
          />
      </div>
    </div>
  );
};

export default ShiftCalendarPage;