
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useEmployees } from '../../contexts/EmployeeContext';
import { useTimeRecords } from '../../hooks/useTimeRecords';
import { useTheoreticalShifts } from '../../hooks/useTheoreticalShifts';
import { useAuth } from '../../hooks/useAuth';
import { useLogs } from '../../hooks/useLogs';
import { useToasts } from '../../hooks/useToasts';
import Card from '../ui/Card';
import Button from '../ui/Button';
import { exportToCSV, exportToExcel, exportToPDF } from '../../utils/exportUtils';
import { getWeekStartDate, getDateRange } from '../../utils/dateUtils';
import { formatTime } from '../../utils/formatters';
import { usePeriodNavigator, PeriodViewMode } from '../../hooks/usePeriodNavigator';
import SortableHeader from '../ui/SortableHeader';
import { 
  ExportIcon, DocumentTextIcon, TableCellsIcon, DocumentArrowDownIcon,
  ChevronLeftIcon, ChevronRightIcon
} from '../ui/icons';

// --- Type Definitions ---
interface ReportStat {
  employeeId: string;
  name: string;
  totalHoursWorked: number;
  totalHoursScheduled: number;
  differenceHours: number;
  absenceDays: number;
  tardinessIncidents: number;
  tardinessMinutes: number;
}
interface DailyReportItem {
  date: string; // "DD/MM/YYYY" format for display
  isoDate: string; // "YYYY-MM-DD" for sorting
  dayOfWeek: string;
  scheduledShift: string;
  actualClocks: string;
  scheduledHours: number;
  workedHours: number;
  differenceHours: number;
}
type SortableReportKey = keyof ReportStat | keyof DailyReportItem;
type ReportDataType = ReportStat[] | DailyReportItem[];

// --- Chart Components ---
const BarChart: React.FC<{ data: ReportStat[] }> = ({ data }) => {
  const chartHeight = 300;
  const barGroupWidth = 80;
  const chartWidth = data.length * barGroupWidth;
  const yPadding = 40;
  const xPadding = 50;

  const maxHours = Math.ceil(Math.max(...data.flatMap(d => [d.totalHoursScheduled, d.totalHoursWorked]), 10));
  const yScale = (chartHeight - yPadding * 2) / maxHours;
  
  const yAxisLabels = [];
  const step = Math.ceil(maxHours / 5) || 1; 
  for(let i = 0; i <= maxHours; i+= step) yAxisLabels.push(Math.round(i));
  if (!yAxisLabels.includes(Math.round(maxHours))) yAxisLabels.push(Math.round(maxHours));

  return (
    <Card title="Comparativo de Horas">
      <div className="w-full overflow-x-auto p-4 bg-gray-50 dark:bg-gray-800 rounded">
        <svg width={chartWidth + xPadding} height={chartHeight} className="min-w-full">
          <g className="text-xs text-gray-500 dark:text-gray-400">
            {yAxisLabels.map((label, i) => {
              const y = chartHeight - yPadding - (label * yScale);
              return (
                <g key={`y-axis-${i}`}>
                  <line x1={xPadding - 5} y1={y} x2={chartWidth + xPadding} y2={y} stroke="currentColor" strokeDasharray="2,2" strokeOpacity="0.3"/>
                  <text x={xPadding - 10} y={y + 4} textAnchor="end" className="fill-current">{label}</text>
                </g>
              );
            })}
            <line x1={xPadding} y1={yPadding} x2={xPadding} y2={chartHeight - yPadding} stroke="currentColor" />
          </g>
          {data.map((stat, index) => {
            const scheduledBarHeight = stat.totalHoursScheduled * yScale;
            const workedBarHeight = stat.totalHoursWorked * yScale;
            const x = xPadding + index * barGroupWidth;
            return (
              <g key={stat.employeeId} transform={`translate(${x}, 0)`} className="cursor-pointer group">
                <title>{`${stat.name}\nProgramado: ${stat.totalHoursScheduled.toFixed(2)} hrs\nTrabajado: ${stat.totalHoursWorked.toFixed(2)} hrs`}</title>
                <rect x={15} y={chartHeight - yPadding - scheduledBarHeight} width={20} height={scheduledBarHeight} fill="#6c757d" className="transition-opacity duration-200 group-hover:opacity-75"/>
                <rect x={45} y={chartHeight - yPadding - workedBarHeight} width={20} height={workedBarHeight} fill="#007bff" className="transition-opacity duration-200 group-hover:opacity-75"/>
                <text x={barGroupWidth / 2} y={chartHeight - yPadding + 15} textAnchor="middle" className="text-xs fill-current text-gray-700 dark:text-gray-200 select-none">{stat.name.split(' ')[0]}</text>
              </g>
            )
          })}
        </svg>
      </div>
      <div className="flex justify-center items-center space-x-4 mt-2 text-xs text-gray-600 dark:text-gray-300">
        <div className="flex items-center"><div className="w-3 h-3 rounded-sm mr-1" style={{backgroundColor: '#6c757d'}}></div><span>Horas Programadas</span></div>
        <div className="flex items-center"><div className="w-3 h-3 rounded-sm mr-1" style={{backgroundColor: '#007bff'}}></div><span>Horas Trabajadas</span></div>
      </div>
    </Card>
  )
};

const LineChart: React.FC<{ data: DailyReportItem[] }> = ({ data }) => {
    const chartHeight = 300;
    const chartWidth = 600;
    const yPadding = 40;
    const xPadding = 50;

    const { min, max } = useMemo(() => {
        const diffs = data.map(d => d.differenceHours);
        const minVal = Math.min(...diffs, 0);
        const maxVal = Math.max(...diffs, 0);
        const buffer = Math.max(Math.abs(minVal), Math.abs(maxVal)) * 0.1 || 1;
        return { min: Math.floor(minVal - buffer), max: Math.ceil(maxVal + buffer) };
    }, [data]);

    const yRange = max - min;
    const yScale = yRange === 0 ? 0 : (chartHeight - yPadding * 2) / yRange;
    const xStep = (chartWidth - xPadding * 2) / (data.length - 1 || 1);

    const getX = (index: number) => xPadding + index * xStep;
    const getY = (value: number) => chartHeight - yPadding - (value - min) * yScale;
    
    const pathData = data.map((d, i) => `${i === 0 ? 'M' : 'L'} ${getX(i)} ${getY(d.differenceHours)}`).join(' ');

    const yAxisLabels = yRange > 0 ? Array.from({length: 6}, (_, i) => Math.round(min + (yRange/5)*i)) : [0];

    return (
        <Card title="Tendencia de Horas (Diferencia vs Programado)">
            <div className="w-full overflow-x-auto p-4 bg-gray-50 dark:bg-gray-800 rounded">
                <svg width={chartWidth} height={chartHeight} viewBox={`0 0 ${chartWidth} ${chartHeight}`}>
                    <g className="text-xs text-gray-500 dark:text-gray-400">
                        {yAxisLabels.map((label, i) => (
                            <g key={`y-grid-${i}`}>
                                <line x1={xPadding} y1={getY(label)} x2={chartWidth - xPadding} y2={getY(label)} stroke="currentColor" strokeDasharray="2,2" strokeOpacity="0.3" />
                                <text x={xPadding - 8} y={getY(label) + 4} textAnchor="end" className="fill-current">{label}h</text>
                            </g>
                        ))}
                        <line x1={getX(0)} y1={getY(0)} x2={chartWidth - xPadding} y2={getY(0)} stroke="#6c757d" strokeWidth="1"/>
                        <line x1={xPadding} y1={yPadding} x2={xPadding} y2={chartHeight - yPadding} stroke="currentColor" />
                    </g>
                    <g className="text-xs text-gray-700 dark:text-gray-200 fill-current">
                        {data.map((d, i) => (
                            (i % Math.ceil(data.length / 10) === 0 || data.length <= 10) && (
                                <text key={`x-label-${i}`} x={getX(i)} y={chartHeight - yPadding + 15} textAnchor="middle">{d.date.substring(0,5)}</text>
                            )
                        ))}
                    </g>
                    <path d={pathData} fill="none" stroke="#007bff" strokeWidth="2" />
                    <g>
                        {data.map((d, i) => (
                            <circle key={`point-${i}`} cx={getX(i)} cy={getY(d.differenceHours)} r="4"
                                fill={d.differenceHours >= 0 ? 'green' : 'red'}
                                className="cursor-pointer transition-all hover:r-6"
                            >
                                <title>{`${d.date}: ${d.differenceHours.toFixed(2)} hrs`}</title>
                            </circle>
                        ))}
                    </g>
                </svg>
            </div>
            <div className="flex justify-center items-center space-x-4 mt-2 text-xs text-gray-600 dark:text-gray-300">
                <div className="flex items-center"><div className="w-3 h-3 rounded-full mr-1" style={{backgroundColor: 'green'}}></div><span>Sobretiempo</span></div>
                <div className="flex items-center"><div className="w-3 h-3 rounded-full mr-1" style={{backgroundColor: 'red'}}></div><span>Horas Faltantes</span></div>
            </div>
        </Card>
    );
};

// --- Table Components ---
type ReportTableProps = {
    reportData: ReportDataType,
    isSingleEmployeeReport: boolean,
    sortConfig: { key: SortableReportKey; direction: 'ascending' | 'descending' } | null,
    requestSort: (key: SortableReportKey) => void,
}
const ReportTable: React.FC<ReportTableProps> = ({ reportData, isSingleEmployeeReport, sortConfig, requestSort }) => {
    
    const reportRowsWithSubtotals = useMemo(() => {
        if (!isSingleEmployeeReport || !reportData || reportData.length === 0) return [];
        const data = reportData as DailyReportItem[];
        const groupedByWeek: { [weekId: string]: DailyReportItem[] } = {};

        data.forEach(item => {
            const weekId = getWeekStartDate(new Date(item.isoDate)).toISOString();
            if (!groupedByWeek[weekId]) groupedByWeek[weekId] = [];
            groupedByWeek[weekId].push(item);
        });
        
        const finalRows: (DailyReportItem | { type: 'subtotal'; weekId: string; totals: any })[] = [];
        const sortedWeekIds = Object.keys(groupedByWeek).sort((a,b) => new Date(a).getTime() - new Date(b).getTime());

        sortedWeekIds.forEach(weekId => {
            const weekItems = groupedByWeek[weekId];
            finalRows.push(...weekItems);
            const subtotal = weekItems.reduce((acc, curr) => ({
                scheduledHours: acc.scheduledHours + curr.scheduledHours,
                workedHours: acc.workedHours + curr.workedHours,
                differenceHours: acc.differenceHours + curr.differenceHours
            }), { scheduledHours: 0, workedHours: 0, differenceHours: 0 });
            finalRows.push({ type: 'subtotal', weekId: weekId, totals: subtotal });
        });
        return finalRows;
    }, [isSingleEmployeeReport, reportData]);


    const renderSummaryTable = () => (
        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-700/50">
                <tr>
                    <SortableHeader title="Nombre" sortKey="name" sortConfig={sortConfig as any} onSort={requestSort as any}/>
                    <SortableHeader title="Hrs. Trabajadas" sortKey="totalHoursWorked" sortConfig={sortConfig as any} onSort={requestSort as any}/>
                    <SortableHeader title="Hrs. Programadas" sortKey="totalHoursScheduled" sortConfig={sortConfig as any} onSort={requestSort as any}/>
                    <SortableHeader title="Diferencia" sortKey="differenceHours" sortConfig={sortConfig as any} onSort={requestSort as any}/>
                    <SortableHeader title="Ausencias" sortKey="absenceDays" sortConfig={sortConfig as any} onSort={requestSort as any}/>
                    <SortableHeader title="Atrasos" sortKey="tardinessIncidents" sortConfig={sortConfig as any} onSort={requestSort as any}/>
                </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                {(reportData as ReportStat[]).map(stat => (
                    <tr key={stat.employeeId}>
                        <td className="px-4 py-2 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-gray-100">{stat.name}</td>
                        <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">{stat.totalHoursWorked.toFixed(2)}</td>
                        <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">{stat.totalHoursScheduled.toFixed(2)}</td>
                        <td className={`px-4 py-2 whitespace-nowrap text-sm font-semibold ${stat.differenceHours >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>{stat.differenceHours.toFixed(2)}</td>
                        <td className={`px-4 py-2 whitespace-nowrap text-sm font-semibold ${stat.absenceDays > 0 ? 'text-red-600 dark:text-red-400' : 'text-gray-500 dark:text-gray-300'}`}>{stat.absenceDays}</td>
                        <td className={`px-4 py-2 whitespace-nowrap text-sm font-semibold ${stat.tardinessIncidents > 0 ? 'text-yellow-600 dark:text-yellow-400' : 'text-gray-500 dark:text-gray-300'}`}>{stat.tardinessIncidents}</td>
                    </tr>
                ))}
            </tbody>
        </table>
    );

    const renderDailyTable = () => (
        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-700/50">
                <tr>
                    <SortableHeader title="Fecha" sortKey="isoDate" sortConfig={sortConfig as any} onSort={requestSort as any} />
                    <SortableHeader title="Día" sortKey="dayOfWeek" sortConfig={sortConfig as any} onSort={requestSort as any} />
                    <SortableHeader title="Turno Programado" sortKey="scheduledShift" sortConfig={sortConfig as any} onSort={requestSort as any} />
                    <SortableHeader title="Marcaje Real" sortKey="actualClocks" sortConfig={sortConfig as any} onSort={requestSort as any} />
                    <SortableHeader title="Hrs. Programadas" sortKey="scheduledHours" sortConfig={sortConfig as any} onSort={requestSort as any} />
                    <SortableHeader title="Hrs. Trabajadas" sortKey="workedHours" sortConfig={sortConfig as any} onSort={requestSort as any} />
                    <SortableHeader title="Diferencia" sortKey="differenceHours" sortConfig={sortConfig as any} onSort={requestSort as any} />
                </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                {reportRowsWithSubtotals.map((item, index) => {
                    if ('type' in item && item.type === 'subtotal') {
                        return (
                            <tr key={`subtotal-${item.weekId}`} className="bg-gray-100 dark:bg-gray-700 font-bold">
                                <td colSpan={4} className="px-4 py-2 text-right text-gray-800 dark:text-gray-200">Subtotal Semana</td>
                                <td className="px-4 py-2 text-gray-800 dark:text-gray-200">{item.totals.scheduledHours.toFixed(2)}</td>
                                <td className="px-4 py-2 text-gray-800 dark:text-gray-200">{item.totals.workedHours.toFixed(2)}</td>
                                <td className={`px-4 py-2 font-semibold ${item.totals.differenceHours >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>{item.totals.differenceHours.toFixed(2)}</td>
                            </tr>
                        );
                    }
                    const dailyItem = item as DailyReportItem;
                    return (
                        <tr key={dailyItem.isoDate}>
                            <td className="px-4 py-2 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-gray-100">{dailyItem.date}</td>
                            <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">{dailyItem.dayOfWeek}</td>
                            <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">{dailyItem.scheduledShift}</td>
                            <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">{dailyItem.actualClocks}</td>
                            <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">{dailyItem.scheduledHours.toFixed(2)}</td>
                            <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">{dailyItem.workedHours.toFixed(2)}</td>
                            <td className={`px-4 py-2 whitespace-nowrap text-sm font-semibold ${dailyItem.differenceHours >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>{dailyItem.differenceHours.toFixed(2)}</td>
                        </tr>
                    );
                })}
            </tbody>
        </table>
    );

    return (
        <div className="overflow-x-auto">
            {isSingleEmployeeReport ? renderDailyTable() : renderSummaryTable()}
             {reportData.length === 0 && (
              <div className="text-center p-4 text-gray-500 dark:text-gray-400">No se encontraron datos para los filtros seleccionados.</div>
            )}
        </div>
    );
}

// --- Main Page Component ---
const ReportsPage: React.FC = () => {
  const { activeEmployees } = useEmployees();
  const { dailyRecords, allRecordsLoaded, loadAllRecords } = useTimeRecords();
  const { getEmployeeDailyScheduleInfo, areaList } = useTheoreticalShifts();
  const { currentUser } = useAuth();
  const { addToast } = useToasts();
  const { addLog } = useLogs();
  
  const periodNavigator = usePeriodNavigator('week');
  const [selectedArea, setSelectedArea] = useState<string>('');
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>('');
  const [reportData, setReportData] = useState<ReportDataType | null>(null);
  const [isSingleEmployeeReport, setIsSingleEmployeeReport] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isExportMenuOpen, setIsExportMenuOpen] = useState(false);
  const [sortConfig, setSortConfig] = useState<{ key: SortableReportKey; direction: 'ascending' | 'descending' } | null>({ key: 'name', direction: 'ascending' });
  const exportMenuRef = useRef<HTMLDivElement>(null);
  const actorUsername = currentUser?.username || 'System';

  useEffect(() => { if (!allRecordsLoaded) loadAllRecords(); }, [allRecordsLoaded, loadAllRecords]);
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (exportMenuRef.current && !exportMenuRef.current.contains(event.target as Node)) setIsExportMenuOpen(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const employeesForFilter = useMemo(() => {
    if (selectedArea) return activeEmployees.filter(e => e.area === selectedArea);
    return activeEmployees;
  }, [activeEmployees, selectedArea]);

  const sortedReportData = useMemo(() => {
    if (!reportData) return [];

    if (isSingleEmployeeReport) {
        const items = [...(reportData as DailyReportItem[])];
        if (sortConfig) {
            items.sort((a, b) => {
                const key = sortConfig.key as keyof DailyReportItem;
                const valA = a[key];
                const valB = b[key];
                if (valA < valB) return sortConfig.direction === 'ascending' ? -1 : 1;
                if (valA > valB) return sortConfig.direction === 'ascending' ? 1 : -1;
                return 0;
            });
        }
        return items;
    } else {
        const items = [...(reportData as ReportStat[])];
        if (sortConfig) {
            items.sort((a, b) => {
                const key = sortConfig.key as keyof ReportStat;
                const valA = a[key];
                const valB = b[key];
                if (valA < valB) return sortConfig.direction === 'ascending' ? -1 : 1;
                if (valA > valB) return sortConfig.direction === 'ascending' ? 1 : -1;
                return 0;
            });
        }
        return items;
    }
  }, [reportData, isSingleEmployeeReport, sortConfig]);

  const handleGenerateReport = async () => {
    setIsLoading(true);
    setReportData(null);
    await new Promise(resolve => setTimeout(resolve, 50));

    const { startDate: sDateObj, endDate: eDateObj } = getDateRange(periodNavigator.viewMode, periodNavigator.currentDate);
    const singleEmployeeMode = !!selectedEmployeeId;
    setIsSingleEmployeeReport(singleEmployeeMode);

    if (singleEmployeeMode) {
      const dailyData: DailyReportItem[] = [];
      const emp = activeEmployees.find(e => e.id === selectedEmployeeId)!;
      const dayNames = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];

      for (let d = new Date(sDateObj); d <= eDateObj; d.setDate(d.getDate() + 1)) {
          if (d > new Date()) continue;
          const dayStr = d.toISOString().split('T')[0];
          const scheduleInfo = getEmployeeDailyScheduleInfo(emp.id, d);
          
          let scheduledHours = 0, workedHours = 0;
          let scheduledShift = "Libre", actualClocks = "Sin Marcaje";
          
          const recordsForDay = dailyRecords.filter(r => r.employeeId === emp.id && r.date === dayStr && r.entrada && r.salida && r.entrada !== 'SIN REGISTRO' && r.salida !== 'SIN REGISTRO' && r.entradaTimestamp && r.salidaTimestamp);
          
          if (recordsForDay.length > 0) {
              let totalMs = recordsForDay.reduce((acc, r) => acc + (r.salidaTimestamp! - r.entradaTimestamp!), 0);
              if (scheduleInfo?.hasColacion && scheduleInfo?.colacionMinutes) totalMs -= scheduleInfo.colacionMinutes * 60 * 1000;
              workedHours = totalMs > 0 ? (totalMs / (1000 * 60 * 60)) : 0;
              const firstIn = Math.min(...recordsForDay.map(r => r.entradaTimestamp!));
              const lastOut = Math.max(...recordsForDay.map(r => r.salidaTimestamp!));
              actualClocks = `${formatTime(new Date(firstIn))} - ${formatTime(new Date(lastOut))}`;
          }

          if (scheduleInfo?.isWorkDay) {
              scheduledHours = scheduleInfo.hours || 0;
              scheduledShift = scheduleInfo.startTime && scheduleInfo.endTime ? `${scheduleInfo.startTime} - ${scheduleInfo.endTime}` : "Definido";
          }
          
          dailyData.push({ date: d.toLocaleDateString('es-CL'), isoDate: dayStr, dayOfWeek: dayNames[d.getDay()], scheduledShift, actualClocks, scheduledHours, workedHours, differenceHours: workedHours - scheduledHours });
      }
      setReportData(dailyData);
    } else {
      let employeesToAnalyze = selectedArea ? activeEmployees.filter(emp => emp.area === selectedArea) : activeEmployees;
      const statsMap = new Map<string, ReportStat>(employeesToAnalyze.map(emp => [emp.id, { employeeId: emp.id, name: emp.name, totalHoursWorked: 0, totalHoursScheduled: 0, differenceHours: 0, absenceDays: 0, tardinessIncidents: 0, tardinessMinutes: 0 }]));

      for (let d = new Date(sDateObj); d <= eDateObj; d.setDate(d.getDate() + 1)) {
          if (d > new Date()) continue;
          for (const emp of employeesToAnalyze) {
              const stats = statsMap.get(emp.id)!;
              const scheduleInfo = getEmployeeDailyScheduleInfo(emp.id, d);

              if (scheduleInfo?.isWorkDay) {
                  stats.totalHoursScheduled += scheduleInfo.hours || 0;
                  const recordsForDay = dailyRecords.filter(r => r.employeeId === emp.id && r.date === d.toISOString().split('T')[0] && r.entrada !== 'SIN REGISTRO' && r.salida !== 'SIN REGISTRO' && r.entradaTimestamp && r.salidaTimestamp);
                  if (recordsForDay.length === 0) {
                      stats.absenceDays++;
                  } else {
                      let totalMs = recordsForDay.reduce((acc, r) => acc + (r.salidaTimestamp! - r.entradaTimestamp!), 0);
                       if (scheduleInfo?.hasColacion && scheduleInfo?.colacionMinutes) totalMs -= scheduleInfo.colacionMinutes * 60 * 1000;
                      stats.totalHoursWorked += totalMs > 0 ? (totalMs / (1000 * 60 * 60)) : 0;
                      // Tardiness logic...
                  }
              }
          }
      }
      setReportData(Array.from(statsMap.values()).map(s => ({ ...s, differenceHours: s.totalHoursWorked - s.totalHoursScheduled })));
    }
    setIsLoading(false);
    addToast("Reporte generado con éxito.", "success");
  };
  
  const handleExport = (format: 'csv' | 'excel' | 'pdf') => {
    if (!sortedReportData || sortedReportData.length === 0) { addToast("No hay datos para exportar.", "info"); return; }
    setIsExportMenuOpen(false);
    
    let headers: string[] = [], data: any[][] = [], title: string = '';
    const employeeName = selectedEmployeeId ? activeEmployees.find(e => e.id === selectedEmployeeId)?.name : 'N/A';
    const filtersString = `Período: ${periodNavigator.headerDisplay}, Área: ${selectedArea || 'Todas'}, Empleado: ${employeeName || 'Todos'}`;

    if (isSingleEmployeeReport) {
        title = `Reporte Diario para ${employeeName}`;
        headers = ['Fecha', 'Día', 'Turno Programado', 'Marcaje Real', 'Hrs. Prog.', 'Hrs. Trab.', 'Dif.'];
        data = (sortedReportData as DailyReportItem[]).map(i => [i.date, i.dayOfWeek, i.scheduledShift, i.actualClocks, i.scheduledHours.toFixed(2), i.workedHours.toFixed(2), i.differenceHours.toFixed(2)]);
    } else {
        title = "Reporte de Horas por Empleado";
        headers = ['Nombre', 'Hrs. Trab.', 'Hrs. Prog.', 'Dif.', 'Aus.', 'Atr.'];
        data = (sortedReportData as ReportStat[]).map(s => [s.name, s.totalHoursWorked.toFixed(2), s.totalHoursScheduled.toFixed(2), s.differenceHours.toFixed(2), s.absenceDays, s.tardinessIncidents]);
    }
    
    if (format === 'csv') exportToCSV(headers, data, "reporte");
    else if (format === 'excel') exportToExcel(headers, data, "reporte", "Reporte");
    else exportToPDF(title, headers, data, filtersString);
    
    addToast(`Reporte exportado a ${format.toUpperCase()}.`, "success");
    addLog(actorUsername, `Exported Report to ${format.toUpperCase()}`, { type: isSingleEmployeeReport ? 'daily' : 'summary' });
  };
  
  const requestSort = (key: SortableReportKey) => {
    const direction = sortConfig && sortConfig.key === key && sortConfig.direction === 'ascending' ? 'descending' : 'ascending';
    setSortConfig({ key, direction });
  };
  
  return (
    <div className="p-4 md:p-6 space-y-6">
      <h1 className="text-3xl font-semibold text-gray-800 dark:text-gray-100">Centro de Reportes</h1>
      <Card title="Configuración del Reporte">
        <div className="flex flex-col sm:flex-row justify-between items-center gap-4 mb-4">
            <div className="flex items-center gap-2 sm:gap-4 flex-wrap">
                <div className="flex space-x-1 sm:space-x-2 p-1 bg-gray-200 dark:bg-gray-700 rounded-lg">
                    {(['day', 'week', 'month'] as PeriodViewMode[]).map(p => (
                        <Button key={p} onClick={() => periodNavigator.setViewMode(p)} size="sm" variant={periodNavigator.viewMode === p ? 'primary' : 'secondary'} className={periodNavigator.viewMode !== p ? '!bg-transparent dark:!bg-transparent text-gray-700 dark:text-gray-300' : ''}>
                            {p === 'day' ? 'Día' : p === 'week' ? 'Semana' : 'Mes'}
                        </Button>
                    ))}
                </div>
                <div className="flex items-center">
                    <Button onClick={periodNavigator.handlePrev} size="sm" aria-label="Anterior" className="p-1.5 rounded-l-md rounded-r-none border-r-0"><ChevronLeftIcon className="w-5 h-5"/></Button>
                    <Button onClick={periodNavigator.handleToday} size="sm" variant="secondary" className={`rounded-none ${periodNavigator.isViewingCurrentPeriod && 'bg-green-500 hover:bg-green-600 dark:bg-green-600 dark:hover:bg-green-700 text-white'}`} disabled={periodNavigator.isViewingCurrentPeriod}>Actual</Button>
                    <Button onClick={periodNavigator.handleNext} size="sm" aria-label="Siguiente" className="p-1.5 rounded-r-md rounded-l-none"><ChevronRightIcon className="w-5 h-5"/></Button>
                </div>
            </div>
            <h2 className="text-lg font-semibold text-gray-700 dark:text-gray-200 text-center sm:text-right capitalize">{periodNavigator.headerDisplay}</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-end">
            <div>
                <label htmlFor="areaFilterReport" className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Área</label>
                <select id="areaFilterReport" value={selectedArea} onChange={e => { setSelectedArea(e.target.value); setSelectedEmployeeId(''); }} className="block w-full px-3 py-2 border border-sap-border dark:border-gray-600 rounded-md shadow-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-sap-blue focus:border-sap-blue sm:text-sm">
                    <option value="">Todas</option>
                    {areaList.map(area => <option key={area} value={area}>{area}</option>)}
                </select>
            </div>
            <div>
                <label htmlFor="employeeFilterReport" className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Empleado</label>
                <select id="employeeFilterReport" value={selectedEmployeeId} onChange={e => setSelectedEmployeeId(e.target.value)} className="block w-full px-3 py-2 border border-sap-border dark:border-gray-600 rounded-md shadow-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-sap-blue focus:border-sap-blue sm:text-sm">
                    <option value="">Todos (Resumen)</option>
                    {employeesForFilter.map(emp => <option key={emp.id} value={emp.id}>{emp.name}</option>)}
                </select>
            </div>
        </div>
        <div className="mt-4"><Button onClick={handleGenerateReport} disabled={isLoading}>{isLoading ? "Generando..." : "Generar Reporte"}</Button></div>
      </Card>
      
      {isLoading && <div className="text-center p-4"><p className="dark:text-gray-300">Generando reporte...</p></div>}
      
      {reportData && (isSingleEmployeeReport ? <LineChart data={reportData as DailyReportItem[]} /> : <BarChart data={reportData as ReportStat[]} />)}
      
      {reportData && (
        <Card>
          <div className="px-4 py-3 bg-gray-50 dark:bg-gray-700/50 border-b border-sap-border dark:border-gray-600 flex justify-between items-center">
            <h3 className="text-lg font-medium leading-6 text-sap-dark-gray dark:text-gray-100">Resultados del Reporte</h3>
            <div className="relative inline-block text-left" ref={exportMenuRef}>
              <Button onClick={() => setIsExportMenuOpen(prev => !prev)} size="sm" className="flex items-center"><ExportIcon className="mr-1 h-4 w-4"/> Exportar</Button>
              {isExportMenuOpen && (
                <div className="origin-top-right absolute right-0 mt-2 w-56 rounded-md shadow-lg bg-white dark:bg-gray-800 ring-1 ring-black ring-opacity-5 focus:outline-none z-10">
                  <div className="py-1" role="menu">
                    <button onClick={() => handleExport('csv')} className="flex items-center w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700" role="menuitem"><DocumentTextIcon className="w-5 h-5 mr-2"/> CSV</button>
                    <button onClick={() => handleExport('excel')} className="flex items-center w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700" role="menuitem"><TableCellsIcon className="w-5 h-5 mr-2"/> Excel</button>
                    <button onClick={() => handleExport('pdf')} className="flex items-center w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700" role="menuitem"><DocumentArrowDownIcon className="w-5 h-5 mr-2"/> PDF</button>
                  </div>
                </div>
              )}
            </div>
          </div>
          <ReportTable reportData={sortedReportData} isSingleEmployeeReport={isSingleEmployeeReport} sortConfig={sortConfig} requestSort={requestSort} />
        </Card>
      )}
    </div>
  );
};

export default ReportsPage;
