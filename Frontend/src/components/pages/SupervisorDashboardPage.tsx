
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useEmployees } from '../../contexts/EmployeeContext';
import { useTimeRecords } from '../../hooks/useTimeRecords';
import { useTheoreticalShifts } from '../../hooks/useTheoreticalShifts';
import { useAuth } from '../../hooks/useAuth';
import { useLogs } from '../../hooks/useLogs';
import { useToasts } from '../../hooks/useToasts';
import { Employee } from '../../types';
import Card from '../ui/Card';
import Button from '../ui/Button';
import { exportToCSV, exportToExcel, exportToPDF } from '../../utils/exportUtils';
import { usePeriodNavigator } from '../../hooks/usePeriodNavigator';
import SortableHeader from '../ui/SortableHeader';
import { 
  ExclamationTriangleIcon, ChevronLeftIcon, ChevronRightIcon,
  ExportIcon, DocumentTextIcon, TableCellsIcon, DocumentArrowDownIcon
} from '../ui/icons';
import { getDateRange } from '../../utils/dateUtils';


interface EmployeeStat {
  employeeId: string;
  name: string;
  totalHoursWorked: number;
  totalHoursScheduled: number;
  overtimeHours: number;
  tardinessIncidents: number;
  tardinessMinutes: number;
  absenceDays: number;
}

interface Incident {
  employeeName: string;
  employeeId: string;
  type: 'Tardiness' | 'Absence';
  date: string; // YYYY-MM-DD
  details: string; // e.g., "15 minutos tarde"
  timestamp: number;
}

const SupervisorDashboardPage: React.FC = () => {
  const periodNavigator = usePeriodNavigator('week');
  const [sortConfig, setSortConfig] = useState<{ key: keyof EmployeeStat; direction: 'ascending' | 'descending' } | null>({ key: 'name', direction: 'ascending' });
  const [isExportMenuOpen, setIsExportMenuOpen] = useState(false);
  const exportMenuRef = useRef<HTMLDivElement>(null);
  const [selectedArea, setSelectedArea] = useState<string>('');
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>('');

  const { activeEmployees, isLoadingEmployees } = useEmployees();
  const { dailyRecords, isLoadingRecords, allRecordsLoaded, loadAllRecords } = useTimeRecords();
  const { getEmployeeDailyScheduleInfo, isLoadingShifts, areaList } = useTheoreticalShifts();
  const { currentUser } = useAuth();
  const { addToast } = useToasts();
  const { addLog } = useLogs();
  
  const actorUsername = currentUser?.username || 'System';

  useEffect(() => {
    if (!allRecordsLoaded) {
      loadAllRecords();
    }
  }, [allRecordsLoaded, loadAllRecords]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (exportMenuRef.current && !exportMenuRef.current.contains(event.target as Node)) {
        setIsExportMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const isLoading = isLoadingEmployees || isLoadingRecords || isLoadingShifts || !allRecordsLoaded;

  const handleAreaChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedArea(e.target.value);
    setSelectedEmployeeId(''); // Reset employee selection when area changes
  };

  const employeesForFilter = useMemo(() => {
    if (selectedArea) {
      return activeEmployees.filter(e => e.area === selectedArea);
    }
    return activeEmployees;
  }, [activeEmployees, selectedArea]);

  const analysisData = useMemo(() => {
    if (isLoading) return null;

    let employeesToAnalyze = activeEmployees;
    if (selectedArea) {
      employeesToAnalyze = employeesToAnalyze.filter(emp => emp.area === selectedArea);
    }
    if (selectedEmployeeId) {
      employeesToAnalyze = employeesToAnalyze.filter(emp => emp.id === selectedEmployeeId);
    }

    const { startDate, endDate } = getDateRange(periodNavigator.viewMode, periodNavigator.currentDate);
    const employeeStatsMap = new Map<string, EmployeeStat>();
    const incidents: Incident[] = [];

    employeesToAnalyze.forEach(emp => {
      employeeStatsMap.set(emp.id, {
        employeeId: emp.id,
        name: emp.name,
        totalHoursWorked: 0,
        totalHoursScheduled: 0,
        overtimeHours: 0,
        tardinessIncidents: 0,
        tardinessMinutes: 0,
        absenceDays: 0,
      });
    });
    
    for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
        if (d > new Date()) continue; // Don't analyze future days

        employeesToAnalyze.forEach(emp => {
            const stats = employeeStatsMap.get(emp.id)!;
            const dayStr = d.toISOString().split('T')[0];
            const scheduleInfo = getEmployeeDailyScheduleInfo(emp.id, d);

            if (scheduleInfo && scheduleInfo.isWorkDay) {
                stats.totalHoursScheduled += scheduleInfo.hours || 0;
                
                const recordsForDay = dailyRecords.filter(r => r.employeeId === emp.id && r.date === dayStr && r.entrada && r.salida && r.entrada !== 'SIN REGISTRO' && r.salida !== 'SIN REGISTRO' && r.entradaTimestamp && r.salidaTimestamp);

                if (recordsForDay.length === 0) {
                    stats.absenceDays++;
                    incidents.push({ employeeId: emp.id, employeeName: emp.name, type: 'Absence', date: dayStr, details: 'Día completo', timestamp: d.getTime() });
                } else {
                    let totalMillisecondsWorked = 0;
                    recordsForDay.forEach(r => {
                      totalMillisecondsWorked += (r.salidaTimestamp! - r.entradaTimestamp!);
                    });
                    
                    if (scheduleInfo.hasColacion && scheduleInfo.colacionMinutes && scheduleInfo.colacionMinutes > 0) {
                        const breakMilliseconds = scheduleInfo.colacionMinutes * 60 * 1000;
                        totalMillisecondsWorked -= breakMilliseconds;
                    }
                    
                    const dailyWorkedHours = totalMillisecondsWorked > 0 ? totalMillisecondsWorked / (1000 * 60 * 60) : 0;
                    
                    stats.totalHoursWorked += dailyWorkedHours;

                    const overtime = dailyWorkedHours - (scheduleInfo.hours || 0);
                    if (overtime > 0) {
                        stats.overtimeHours += overtime;
                    }
                    
                    const firstRecord = recordsForDay.sort((a,b) => a.entradaTimestamp! - b.entradaTimestamp!)[0];
                    const [startHour, startMinute] = scheduleInfo.startTime!.split(':').map(Number);
                    const scheduledStartTime = new Date(d.getFullYear(), d.getMonth(), d.getDate(), startHour, startMinute).getTime();
                    
                    if(firstRecord.entradaTimestamp! > scheduledStartTime) {
                        const tardinessMins = Math.floor((firstRecord.entradaTimestamp! - scheduledStartTime) / (1000 * 60));
                        if(tardinessMins > 0) {
                            stats.tardinessIncidents++;
                            stats.tardinessMinutes += tardinessMins;
                            incidents.push({ employeeId: emp.id, employeeName: emp.name, type: 'Tardiness', date: dayStr, details: `${tardinessMins} min tarde`, timestamp: d.getTime() });
                        }
                    }
                }
            } else { // Not a scheduled workday
                const recordsForDay = dailyRecords.filter(r => r.employeeId === emp.id && r.date === dayStr && r.entrada && r.salida && r.entrada !== 'SIN REGISTRO' && r.salida !== 'SIN REGISTRO' && r.entradaTimestamp && r.salidaTimestamp);
                let dailyWorkedHours = 0;
                recordsForDay.forEach(r => {
                  dailyWorkedHours += ((r.salidaTimestamp! - r.entradaTimestamp!) / (1000 * 60 * 60));
                });
                if(dailyWorkedHours > 0) {
                    stats.totalHoursWorked += dailyWorkedHours;
                    stats.overtimeHours += dailyWorkedHours;
                }
            }
        });
    }

    const employeeStats = Array.from(employeeStatsMap.values());
    const kpis = employeeStats.reduce((acc, curr) => {
        acc.totalWorked += curr.totalHoursWorked;
        acc.totalOvertime += curr.overtimeHours;
        acc.totalTardinessIncidents += curr.tardinessIncidents;
        acc.totalAbsences += curr.absenceDays;
        return acc;
    }, { totalWorked: 0, totalOvertime: 0, totalTardinessIncidents: 0, totalAbsences: 0 });

    return { kpis, employeeStats, incidents };

  }, [isLoading, periodNavigator.viewMode, periodNavigator.currentDate, activeEmployees, dailyRecords, getEmployeeDailyScheduleInfo, selectedArea, selectedEmployeeId]);
  
  const requestSort = (key: keyof EmployeeStat) => {
    let direction: 'ascending' | 'descending' = 'ascending';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'ascending') {
        direction = 'descending';
    }
    setSortConfig({ key, direction });
  };
  
  const sortedEmployeeStats = useMemo(() => {
    if (!analysisData?.employeeStats) return [];
    const sortableItems = [...analysisData.employeeStats];
    if (sortConfig !== null) {
      sortableItems.sort((a, b) => {
        if (a[sortConfig.key] < b[sortConfig.key]) {
          return sortConfig.direction === 'ascending' ? -1 : 1;
        }
        if (a[sortConfig.key] > b[sortConfig.key]) {
          return sortConfig.direction === 'ascending' ? 1 : -1;
        }
        return 0;
      });
    }
    return sortableItems;
  }, [analysisData, sortConfig]);
  
  const handleExport = (format: 'csv' | 'excel' | 'pdf') => {
    if (!analysisData?.employeeStats || analysisData.employeeStats.length === 0) {
      addToast("No hay datos para exportar.", "info");
      return;
    }
    
    setIsExportMenuOpen(false);
    const headers = ['Nombre', 'Trabajado (hrs)', 'Programado (hrs)', 'Sobretiempo (hrs)', 'Atrasos (inc.)', 'Ausencias (días)'];
    const data = sortedEmployeeStats.map(stat => [
        stat.name,
        stat.totalHoursWorked.toFixed(1),
        stat.totalHoursScheduled.toFixed(1),
        stat.overtimeHours.toFixed(1),
        stat.tardinessIncidents,
        stat.absenceDays
    ]);
    
    const selectedEmployee = selectedEmployeeId ? activeEmployees.find(e => e.id === selectedEmployeeId) : null;
    let filtersString = `Período: ${periodNavigator.headerDisplay}`;
    if (selectedArea) filtersString += `, Área: ${selectedArea}`;
    if (selectedEmployee) filtersString += `, Empleado: ${selectedEmployee.name}`;

    switch (format) {
      case 'csv':
        exportToCSV(headers, data, "rendimiento_empleados");
        break;
      case 'excel':
        exportToExcel(headers, data, "rendimiento_empleados", "Rendimiento");
        break;
      case 'pdf':
        exportToPDF("Reporte de Rendimiento por Empleado", headers, data, filtersString);
        break;
      default:
        addToast('Formato de exportación no soportado.', 'error');
        return;
    }

    addToast(`Reporte de rendimiento exportado a ${format.toUpperCase()}.`, "success");
    addLog(actorUsername, `Exported Supervisor Stats to ${format.toUpperCase()}`, { 
        numberOfRecords: analysisData.employeeStats.length,
        period: periodNavigator.headerDisplay,
        area: selectedArea || 'All',
        employee: selectedEmployee?.name || 'All'
    });
  };

  if (isLoading) {
    return <div className="p-6 text-center dark:text-gray-200">Cargando datos de supervisión...</div>;
  }

  return (
    <div className="p-4 md:p-6 space-y-6">
      <h1 className="text-3xl font-semibold text-gray-800 dark:text-gray-100">Dashboard de Supervisión</h1>
      
      {/* Date Navigation Controls */}
      <Card>
        <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
            <div className="flex items-center gap-2 sm:gap-4 flex-wrap">
                <div className="flex space-x-1 sm:space-x-2 p-1 bg-gray-200 dark:bg-gray-700 rounded-lg">
                    {(['day', 'week', 'month'] as const).map(p => (
                        <Button
                        key={p}
                        onClick={() => periodNavigator.setViewMode(p)}
                        size="sm"
                        variant={periodNavigator.viewMode === p ? 'primary' : 'secondary'}
                        className={periodNavigator.viewMode !== p ? '!bg-transparent dark:!bg-transparent text-gray-700 dark:text-gray-300' : ''}
                        >
                        {p === 'day' ? 'Día' : p === 'week' ? 'Semana' : 'Mes'}
                        </Button>
                    ))}
                </div>
                <div className="flex items-center">
                    <Button onClick={periodNavigator.handlePrev} size="sm" aria-label="Anterior" className="p-1.5 rounded-l-md rounded-r-none border-r-0"><ChevronLeftIcon className="w-5 h-5"/></Button>
                    <Button 
                        onClick={periodNavigator.handleToday} 
                        size="sm" 
                        variant="secondary"
                        className={`rounded-none ${
                            periodNavigator.isViewingCurrentPeriod && 'bg-green-500 hover:bg-green-600 dark:bg-green-600 dark:hover:bg-green-700 text-white'
                        }`}
                        disabled={periodNavigator.isViewingCurrentPeriod}
                    >
                        Actual
                    </Button>
                    <Button onClick={periodNavigator.handleNext} size="sm" aria-label="Siguiente" className="p-1.5 rounded-r-md rounded-l-none"><ChevronRightIcon className="w-5 h-5"/></Button>
                </div>
                <div className="flex items-center">
                  <label htmlFor="areaFilter" className="text-sm font-medium text-gray-700 dark:text-gray-300 mr-2">Área:</label>
                  <select
                    id="areaFilter"
                    value={selectedArea}
                    onChange={handleAreaChange}
                    className="block w-full sm:w-auto px-3 py-1.5 border border-sap-border dark:border-gray-600 rounded-md shadow-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-sap-blue focus:border-sap-blue sm:text-sm"
                  >
                    <option value="">Todas</option>
                    {areaList.map((area: string) => <option key={area} value={area}>{area}</option>)}
                  </select>
                </div>
                <div className="flex items-center">
                  <label htmlFor="employeeFilter" className="text-sm font-medium text-gray-700 dark:text-gray-300 mr-2">Empleado:</label>
                  <select
                    id="employeeFilter"
                    value={selectedEmployeeId}
                    onChange={(e) => setSelectedEmployeeId(e.target.value)}
                    className="block w-full sm:w-auto px-3 py-1.5 border border-sap-border dark:border-gray-600 rounded-md shadow-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-sap-blue focus:border-sap-blue sm:text-sm"
                  >
                    <option value="">Todos</option>
                    {employeesForFilter.map((emp) => (
                      <option key={emp.id} value={emp.id}>{emp.name}</option>
                    ))}
                  </select>
                </div>
            </div>
            <h2 className="text-lg font-semibold text-gray-700 dark:text-gray-200 text-center sm:text-right capitalize">
                {periodNavigator.headerDisplay}
            </h2>
        </div>
      </Card>


      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
            <p className="text-sm text-gray-500 dark:text-gray-400">Horas Trabajadas</p>
            <p className="text-3xl font-bold text-sap-blue dark:text-sap-light-blue">{analysisData?.kpis.totalWorked.toFixed(1) || 0}</p>
        </Card>
        <Card>
            <p className="text-sm text-gray-500 dark:text-gray-400">Sobretiempo</p>
            <p className="text-3xl font-bold text-orange-500">{analysisData?.kpis.totalOvertime.toFixed(1) || 0} hrs</p>
        </Card>
        <Card>
            <p className="text-sm text-gray-500 dark:text-gray-400">Atrasos</p>
            <p className="text-3xl font-bold text-yellow-500">{analysisData?.kpis.totalTardinessIncidents || 0}</p>
        </Card>
        <Card>
            <p className="text-sm text-gray-500 dark:text-gray-400">Ausencias</p>
            <p className="text-3xl font-bold text-red-500">{analysisData?.kpis.totalAbsences || 0}</p>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Employee Stats Table */}
        <div className="lg:col-span-2">
            <div className="bg-white dark:bg-gray-800 shadow-md rounded-lg overflow-hidden">
                <div className="px-4 py-3 bg-gray-50 dark:bg-gray-700/50 border-b border-sap-border dark:border-gray-600 flex justify-between items-center">
                    <h3 className="text-lg font-medium leading-6 text-sap-dark-gray dark:text-gray-100">Rendimiento por Empleado</h3>
                    <div className="relative inline-block text-left" ref={exportMenuRef}>
                        <Button onClick={() => setIsExportMenuOpen(prev => !prev)} size="sm" className="flex items-center">
                            <ExportIcon className="mr-1 h-4 w-4"/> Exportar
                        </Button>
                        {isExportMenuOpen && (
                            <div className="origin-top-right absolute right-0 mt-2 w-56 rounded-md shadow-lg bg-white dark:bg-gray-800 ring-1 ring-black ring-opacity-5 focus:outline-none z-10">
                                <div className="py-1" role="menu" aria-orientation="vertical" aria-labelledby="options-menu">
                                    <button onClick={() => handleExport('csv')} className="flex items-center w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700" role="menuitem">
                                    <DocumentTextIcon className="w-5 h-5 mr-2" /> Exportar a CSV
                                    </button>
                                    <button onClick={() => handleExport('excel')} className="flex items-center w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700" role="menuitem">
                                    <TableCellsIcon className="w-5 h-5 mr-2" /> Exportar a Excel
                                    </button>
                                    <button onClick={() => handleExport('pdf')} className="flex items-center w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700" role="menuitem">
                                    <DocumentArrowDownIcon className="w-5 h-5 mr-2" /> Exportar a PDF
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
                <div className="overflow-x-auto max-h-[60vh]">
                    <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                        <thead className="bg-gray-50 dark:bg-gray-700/50 sticky top-0">
                            <tr>
                                <SortableHeader title="Nombre" sortKey="name" sortConfig={sortConfig} onSort={requestSort} />
                                <SortableHeader title="Trabajado" sortKey="totalHoursWorked" sortConfig={sortConfig} onSort={requestSort} />
                                <SortableHeader title="Programado" sortKey="totalHoursScheduled" sortConfig={sortConfig} onSort={requestSort} />
                                <SortableHeader title="Sobretiempo" sortKey="overtimeHours" sortConfig={sortConfig} onSort={requestSort} />
                                <SortableHeader title="Atrasos" sortKey="tardinessIncidents" sortConfig={sortConfig} onSort={requestSort} />
                                <SortableHeader title="Ausencias" sortKey="absenceDays" sortConfig={sortConfig} onSort={requestSort} />
                            </tr>
                        </thead>
                        <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                            {sortedEmployeeStats.map(stat => (
                                <tr key={stat.employeeId}>
                                    <td className="px-4 py-2 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-gray-100">{stat.name}</td>
                                    <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">{stat.totalHoursWorked.toFixed(1)}</td>
                                    <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">{stat.totalHoursScheduled.toFixed(1)}</td>
                                    <td className={`px-4 py-2 whitespace-nowrap text-sm font-semibold ${stat.overtimeHours > 0 ? 'text-orange-500' : 'text-gray-500 dark:text-gray-300'}`}>{stat.overtimeHours.toFixed(1)}</td>
                                    <td className={`px-4 py-2 whitespace-nowrap text-sm font-semibold ${stat.tardinessIncidents > 0 ? 'text-yellow-500' : 'text-gray-500 dark:text-gray-300'}`}>{stat.tardinessIncidents}</td>
                                    <td className={`px-4 py-2 whitespace-nowrap text-sm font-semibold ${stat.absenceDays > 0 ? 'text-red-500' : 'text-gray-500 dark:text-gray-300'}`}>{stat.absenceDays}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>

        {/* Incidents Feed */}
        <div>
            <Card title="Incidencias Recientes">
                <div className="space-y-3 max-h-[60vh] overflow-y-auto">
                    {analysisData && analysisData.incidents.length > 0 ? (
                        analysisData.incidents
                            .sort((a,b) => b.timestamp - a.timestamp)
                            .map((incident, index) => (
                            <div key={index} className="flex items-start">
                                <div className={`mr-3 mt-1 flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center ${incident.type === 'Absence' ? 'bg-red-500' : 'bg-yellow-500'}`}>
                                    <ExclamationTriangleIcon className="w-3 h-3 text-white" />
                                </div>
                                <div>
                                    <p className="text-sm font-medium text-gray-800 dark:text-gray-100">{incident.employeeName}</p>
                                    <p className="text-sm text-gray-600 dark:text-gray-400">
                                        {incident.type === 'Absence' ? 'Ausente' : 'Atraso'} el {new Date(incident.date+'T00:00:00Z').toLocaleDateString('es-CL')}
                                        <span className="font-semibold"> ({incident.details})</span>
                                    </p>
                                </div>
                            </div>
                        ))
                    ) : (
                        <p className="text-center text-sm text-gray-500 dark:text-gray-400 py-4">No hay incidencias en el período seleccionado.</p>
                    )}
                </div>
            </Card>
        </div>
      </div>
    </div>
  );
};

export default SupervisorDashboardPage;
