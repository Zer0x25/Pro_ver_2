import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { TheoreticalShiftPattern, AssignedShift } from '../../types';
import { useTheoreticalShifts } from '../../hooks/useTheoreticalShifts';
import { useShiftPatternForm } from '../../hooks/useShiftPatternForm';
import { useShiftAssignmentForm } from '../../hooks/useShiftAssignmentForm';
import { useEmployees } from '../../contexts/EmployeeContext';
import { useAuth } from '../../hooks/useAuth';
import Button from '../ui/Button';
import Input from '../ui/Input';
import SortableHeader from '../ui/SortableHeader';
import { PlusCircleIcon, EditIcon, DeleteIcon, ClipboardIcon, ClipboardCheckIcon, DocumentDuplicateIcon } from '../ui/icons';

const ITEMS_PER_PAGE = 5;

const daysOfWeekOptions = [
    { value: 1, label: '1. Lunes' },
    { value: 2, label: '2. Martes' },
    { value: 3, label: '3. Miércoles' },
    { value: 4, label: '4. Jueves' },
    { value: 5, label: '5. Viernes' },
    { value: 6, label: '6. Sábado' },
    { value: 7, label: '7. Domingo' },
];

const getDayOfWeekName = (dayIndex: number, startDayOfWeek: number): string => {
    const dayNames = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
    const finalIndex = ((startDayOfWeek - 1) + dayIndex) % 7;
    return dayNames[finalIndex];
};


const TheoreticalShiftsPage: React.FC = () => {
  const {
    globalMaxWeeklyHours,
    shiftPatterns, assignedShifts, isLoadingShifts,
    deleteShiftPattern, getShiftPatternById,
    deleteAssignedShift,
    calculateAverageWeeklyHoursForEmployee,
  } = useTheoreticalShifts();
  const { activeEmployees, isLoadingEmployees } = useEmployees();
  const { currentUser } = useAuth();
  
  const patternForm = useShiftPatternForm();
  const assignmentForm = useShiftAssignmentForm();
  
  const actorUsername = currentUser?.username || 'System';

  const [isPatternFormVisible, setIsPatternFormVisible] = useState(false);
  const [isAssignmentFormVisible, setIsAssignmentFormVisible] = useState(false);
  const [patternSearchTerm, setPatternSearchTerm] = useState('');
  const [patternCurrentPage, setPatternCurrentPage] = useState(1);
  const [assignmentSearchTerm, setAssignmentSearchTerm] = useState('');
  const [assignmentCurrentPage, setAssignmentCurrentPage] = useState(1);
  
  type PatternSortKey = keyof TheoreticalShiftPattern;
  type AssignmentSortKey = keyof (AssignedShift & { assignmentWeeklyHours: number });

  const [patternSortConfig, setPatternSortConfig] = useState<{ key: PatternSortKey; direction: 'ascending' | 'descending' } | null>(null);
  const [assignmentSortConfig, setAssignmentSortConfig] = useState<{ key: AssignmentSortKey; direction: 'ascending' | 'descending' } | null>(null);
  
  const cardHeaderClass = "px-4 py-3 bg-gray-50 dark:bg-gray-700/50 border-b border-sap-border dark:border-gray-600 flex justify-between items-center";
  const cardBodyClass = "p-4 text-gray-800 dark:text-gray-200";
  const cardContainerClass = "bg-white dark:bg-gray-800 shadow-md rounded-lg overflow-hidden";

  useEffect(() => {
    if (patternForm.editingPattern) {
      setIsPatternFormVisible(true);
      document.getElementById('pattern-form-section')?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [patternForm.editingPattern]);

  useEffect(() => {
    if (assignmentForm.editingAssignment) {
      setIsAssignmentFormVisible(true);
      document.getElementById('assignment-form-section')?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [assignmentForm.editingAssignment]);
  
  const requestPatternSort = useCallback((key: PatternSortKey) => {
    let direction: 'ascending' | 'descending' = 'ascending';
    if (patternSortConfig?.key === key && patternSortConfig.direction === 'ascending') direction = 'descending';
    setPatternSortConfig({ key, direction });
  }, [patternSortConfig]);

  const requestAssignmentSort = useCallback((key: AssignmentSortKey) => {
    let direction: 'ascending' | 'descending' = 'ascending';
    if (assignmentSortConfig?.key === key && assignmentSortConfig.direction === 'ascending') direction = 'descending';
    setAssignmentSortConfig({ key, direction });
  }, [assignmentSortConfig]);

  const handleOpenNewPatternForm = () => { patternForm.clearForm(); setIsPatternFormVisible(true); };
  const handleCancelPatternForm = () => { patternForm.clearForm(); setIsPatternFormVisible(false); };
  const handleSavePatternForm = async () => { if (await patternForm.handleSavePattern()) setIsPatternFormVisible(false); };
  
  const handleOpenNewAssignmentForm = () => { assignmentForm.clearForm(); setIsAssignmentFormVisible(true); };
  const handleCancelAssignmentForm = () => { assignmentForm.clearForm(); setIsAssignmentFormVisible(false); };
  const handleSaveAssignmentForm = async () => { if (await assignmentForm.handleSaveAssignment()) setIsAssignmentFormVisible(false); };

  const processedPatterns = useMemo(() => {
    let items = shiftPatterns.filter(p => p.name.toLowerCase().includes(patternSearchTerm.toLowerCase()));
    if (patternSortConfig) {
      items.sort((a, b) => {
        const valA = a[patternSortConfig.key], valB = b[patternSortConfig.key];
        if (valA === undefined || valA === null) return 1; if (valB === undefined || valB === null) return -1;
        if (valA < valB) return patternSortConfig.direction === 'ascending' ? -1 : 1;
        if (valA > valB) return patternSortConfig.direction === 'ascending' ? 1 : -1;
        return 0;
      });
    }
    return items;
  }, [shiftPatterns, patternSearchTerm, patternSortConfig]);

  const paginatedPatterns = useMemo(() => processedPatterns.slice((patternCurrentPage - 1) * ITEMS_PER_PAGE, patternCurrentPage * ITEMS_PER_PAGE), [processedPatterns, patternCurrentPage]);
  const totalPatternPages = Math.ceil(processedPatterns.length / ITEMS_PER_PAGE);

  const processedAssignments = useMemo(() => {
    const assignmentsWithHours = assignedShifts.map(as => {
        const pattern = getShiftPatternById(as.shiftPatternId);
        let assignmentWeeklyHours = 0;
        if (pattern && pattern.cycleLengthDays && pattern.cycleLengthDays > 0 && Array.isArray(pattern.dailySchedules)) {
            const totalHoursInCycle = pattern.dailySchedules.reduce((sum, day) => sum + (day.hours || 0), 0);
            assignmentWeeklyHours = (totalHoursInCycle / pattern.cycleLengthDays) * 7;
        }
        return { ...as, assignmentWeeklyHours };
    });
    let items = assignmentsWithHours.filter(as => (as.employeeName?.toLowerCase() || '').includes(assignmentSearchTerm.toLowerCase()) || (as.shiftPatternName?.toLowerCase() || '').includes(assignmentSearchTerm.toLowerCase()));
    if (assignmentSortConfig) {
      items.sort((a, b) => {
        const valA = a[assignmentSortConfig.key], valB = b[assignmentSortConfig.key];
        if (valA === undefined || valA === null) return 1; if (valB === undefined || valB === null) return -1;
        if (typeof valA === 'string' && typeof valB === 'string') return assignmentSortConfig.direction === 'ascending' ? valA.localeCompare(valB, 'es') : valB.localeCompare(valA, 'es');
        if (valA < valB) return assignmentSortConfig.direction === 'ascending' ? -1 : 1;
        if (valA > valB) return assignmentSortConfig.direction === 'ascending' ? 1 : -1;
        return 0;
      });
    }
    return items;
  }, [assignedShifts, assignmentSearchTerm, getShiftPatternById, assignmentSortConfig]);

  const paginatedAssignments = useMemo(() => processedAssignments.slice((assignmentCurrentPage - 1) * ITEMS_PER_PAGE, assignmentCurrentPage * ITEMS_PER_PAGE), [processedAssignments, assignmentCurrentPage]);
  const totalAssignmentPages = Math.ceil(processedAssignments.length / ITEMS_PER_PAGE);
  
  const renderPagination = (currentPage: number, totalPages: number, setCurrentPage: (page: number) => void) => {
    if (totalPages <= 1) return null;
    return (
      <div className="mt-4 flex justify-between items-center">
        <Button onClick={() => setCurrentPage(Math.max(1, currentPage - 1))} disabled={currentPage === 1} size="sm">Anterior</Button>
        <span className="text-sm dark:text-gray-300">Página {currentPage} de {totalPages}</span>
        <Button onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))} disabled={currentPage === totalPages} size="sm">Siguiente</Button>
      </div>
    );
  };
  
  const renderPlaceholders = useCallback(() => Array.from({ length: patternForm.startDayOfWeek > 1 ? patternForm.startDayOfWeek - 1 : 0 }).map((_, i) => <div key={`ph-${i}`} className="p-3 border-2 border-dashed rounded-md dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/20 min-h-[11rem] hidden lg:block"></div>), [patternForm.startDayOfWeek]);

  if (isLoadingShifts || isLoadingEmployees) return <div className="p-6 text-center dark:text-gray-200">Cargando datos...</div>;
  
  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-semibold text-gray-800 dark:text-gray-100">Gestión de Turnos Teóricos</h1>
      <div id="pattern-form-section" className={cardContainerClass}>
        <div className={cardHeaderClass}>
            <h3 className="text-lg font-medium leading-6 text-sap-dark-gray dark:text-gray-100">Patrones de Turno</h3>
            {!isPatternFormVisible && <Button onClick={handleOpenNewPatternForm} size="sm" className="flex items-center"><PlusCircleIcon className="w-5 h-5 mr-1"/>Crear Nuevo Patrón</Button>}
        </div>
        <div className={cardBodyClass}>
          {isPatternFormVisible && (
            <div className="border-b-2 border-dashed border-gray-300 dark:border-gray-600 mb-4 pb-4">
              <h3 className="text-lg font-semibold mb-3">{patternForm.editingPattern ? 'Editar Patrón' : 'Nuevo Patrón'}</h3>
              <div className="grid grid-cols-1 md:grid-cols-12 gap-4 mb-3 items-start">
                  <div className="md:col-span-8"><Input label="Nombre del Patrón" value={patternForm.patternName} onChange={e => patternForm.setPatternName(e.target.value)}/></div>
                  <div className="md:col-span-1"><Input label="Ciclo" type="number" min="1" max="99" value={String(patternForm.patternCycleLength)} onChange={e => patternForm.setPatternCycleLength(parseInt(e.target.value, 10) || 1)}/></div>
                  <div className="md:col-span-1"><label htmlFor="pStartDay" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Posición</label><select id="pStartDay" value={patternForm.startDayOfWeek} onChange={e => patternForm.setStartDayOfWeek(parseInt(e.target.value, 10))} className="w-full h-10 px-1 py-1 border border-sap-border dark:border-gray-600 rounded-md shadow-sm bg-white dark:bg-gray-700">{daysOfWeekOptions.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}</select></div>
                  <div className="md:col-span-1"><Input label="Max Hrs/Sem" type="number" min="1" max={globalMaxWeeklyHours} value={String(patternForm.patternMaxHoursInput)} onChange={e => patternForm.setPatternMaxHoursInput(parseInt(e.target.value, 10) || 0)} title={`Máx. legal: ${globalMaxWeeklyHours} hrs.`}/></div>
                  <div className="md:col-span-1"><label htmlFor="pColor" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Color</label><input type="color" id="pColor" value={patternForm.patternColor} onChange={e => patternForm.setPatternColor(e.target.value)} className="w-full h-10 px-1 py-1 border border-sap-border dark:border-gray-600 rounded-md"/></div>
              </div>
              <p className={`text-xs mb-3 ${patternForm.calculatedPatternWeeklyHours > patternForm.patternMaxHoursInput ? 'text-red-500 font-semibold' : 'dark:text-gray-400'}`}>Hrs Semanales Calculadas: {patternForm.calculatedPatternWeeklyHours.toFixed(2)}</p>
              <h4 className="text-md font-semibold mt-4 mb-2 dark:text-gray-300">Horarios Diarios del Ciclo:</h4>
              <div className="grid grid-cols-1 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7 gap-3">{renderPlaceholders()}{patternForm.patternDailySchedules.map((s, i) => <div key={i} className="p-3 border rounded-md dark:border-gray-700 bg-gray-50 dark:bg-gray-700/50 flex flex-col min-w-[11rem]"><div className="flex justify-between items-center mb-3"><p className="font-medium text-sm dark:text-gray-200">Día {s.dayIndex + 1}<span className="block text-xs font-normal dark:text-gray-400">{getDayOfWeekName(s.dayIndex, patternForm.startDayOfWeek)}</span></p><div className="space-x-1"><Button onClick={() => patternForm.handleCopyDailySchedule(i)} size="sm" variant="secondary" className="p-1" title="Copiar"><ClipboardIcon className="w-4 h-4"/></Button><Button onClick={() => patternForm.handlePasteDailySchedule(i)} size="sm" variant="secondary" className="p-1" title="Pegar" disabled={!patternForm.copiedDailySchedule}><ClipboardCheckIcon className="w-4 h-4"/></Button></div></div><div className="space-y-3 flex-grow"><label className="flex items-center space-x-2 text-sm dark:text-gray-200 cursor-pointer"><input type="checkbox" checked={s.isOffDay} onChange={e => patternForm.handleDailyScheduleChange(i, 'isOffDay', e.target.checked)} className="form-checkbox h-4 w-4 text-sap-blue"/><span>Día Libre</span></label><div className="space-y-2"><Input label="Inicio" type="time" value={s.startTime || ''} onChange={e => patternForm.handleDailyScheduleChange(i, 'startTime', e.target.value)} disabled={s.isOffDay} className="text-sm w-full"/><Input label="Fin" type="time" value={s.endTime || ''} onChange={e => patternForm.handleDailyScheduleChange(i, 'endTime', e.target.value)} disabled={s.isOffDay} className="text-sm w-full"/></div>{!s.isOffDay && (<div className="space-y-2 pt-2 border-t dark:border-gray-600"><label className="flex items-center space-x-2 text-sm dark:text-gray-200 cursor-pointer"><input type="checkbox" checked={s.hasColacion} onChange={e => patternForm.handleDailyScheduleChange(i, 'hasColacion', e.target.checked)} disabled={s.isOffDay} className="form-checkbox h-4 w-4 text-sap-blue"/><span>Colación</span></label><Input label="Minutos Col." type="number" min="0" value={String(s.colacionMinutes)} onChange={e => patternForm.handleDailyScheduleChange(i, 'colacionMinutes', parseInt(e.target.value, 10) || 0)} disabled={s.isOffDay || !s.hasColacion} className="text-sm w-full"/></div>)}</div><div className="mt-auto pt-3"><p className="text-xs text-center dark:text-gray-400 border-t dark:border-gray-600 pt-2">Horas Netas: <span className="font-semibold">{s.hours?.toFixed(2) || '0.00'}</span></p></div></div>)}</div>
              <div className="flex space-x-2 mt-4"><Button onClick={handleSavePatternForm}><PlusCircleIcon className="w-5 h-5 mr-1 inline"/> {patternForm.editingPattern ? 'Actualizar' : 'Guardar'} Patrón</Button><Button variant="secondary" onClick={handleCancelPatternForm}>Cancelar</Button></div>
            </div>
          )}
          <Input type="search" placeholder="Buscar patrones..." value={patternSearchTerm} onChange={e => setPatternSearchTerm(e.target.value)} className="mb-3"/>
          {paginatedPatterns.length === 0 ? <p className="dark:text-gray-300 text-center py-4">No hay patrones.</p> : (<div className="overflow-x-auto"><table className="min-w-full divide-y dark:divide-gray-700"><thead className="bg-gray-50 dark:bg-gray-700"><tr><SortableHeader title="Nombre" sortKey="name" sortConfig={patternSortConfig} onSort={requestPatternSort}/><SortableHeader title="Ciclo (días)" sortKey="cycleLengthDays" sortConfig={patternSortConfig} onSort={requestPatternSort}/><SortableHeader title="Max Hrs Patrón" sortKey="maxHoursPattern" sortConfig={patternSortConfig} onSort={requestPatternSort}/><th className="px-4 py-2">Color</th><th className="px-4 py-2">Acciones</th></tr></thead><tbody className="bg-white dark:bg-gray-800 divide-y dark:divide-gray-700">{paginatedPatterns.map(p => (<tr key={p.id}><td className="px-4 py-2">{p.name}</td><td className="px-4 py-2">{p.cycleLengthDays}</td><td className="px-4 py-2">{p.maxHoursPattern?.toFixed(2) || globalMaxWeeklyHours}</td><td className="px-4 py-2"><div style={{ backgroundColor: p.color || 'transparent', width: '20px', height: '20px', borderRadius: '50%', border: '1px solid #ccc' }} title={p.color}></div></td><td className="px-4 py-2 space-x-1"><Button size="sm" onClick={() => patternForm.setEditingPattern(p)} className="p-1" title="Editar"><EditIcon/></Button><Button size="sm" variant="secondary" onClick={() => { patternForm.startCopyOfPattern(p); setIsPatternFormVisible(true); }} className="p-1" title="Copiar"><DocumentDuplicateIcon/></Button><Button size="sm" variant="danger" onClick={() => deleteShiftPattern(p.id, actorUsername)} className="p-1" title="Eliminar"><DeleteIcon/></Button></td></tr>))}</tbody></table></div>)}
          {renderPagination(patternCurrentPage, totalPatternPages, setPatternCurrentPage)}
        </div>
      </div>
      <div id="assignment-form-section" className={cardContainerClass}>
        <div className={cardHeaderClass}>
            <h3 className="text-lg font-medium leading-6 text-sap-dark-gray dark:text-gray-100">Asignaciones de Turnos</h3>
            {!isAssignmentFormVisible && <Button onClick={handleOpenNewAssignmentForm} size="sm" className="flex items-center"><PlusCircleIcon className="w-5 h-5 mr-1"/>Asignar Turno</Button>}
        </div>
        <div className={cardBodyClass}>
          {isAssignmentFormVisible && (
            <div className="border-b-2 border-dashed border-gray-300 dark:border-gray-600 mb-4 pb-4">
                <h3 className="text-lg font-semibold mb-3">{assignmentForm.editingAssignment ? 'Editar Asignación' : 'Nueva Asignación'}</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-3"><div><label htmlFor="empSel" className="block text-sm font-medium mb-1 dark:text-gray-300">Empleado:</label><select id="empSel" value={assignmentForm.selectedEmployeeId} onChange={e => assignmentForm.setSelectedEmployeeId(e.target.value)} className="w-full px-3 py-2 border rounded-md dark:border-gray-600 dark:bg-gray-700"><option value="">-- Seleccionar --</option>{activeEmployees.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}</select></div><div><label htmlFor="patSel" className="block text-sm font-medium mb-1 dark:text-gray-300">Patrón:</label><select id="patSel" value={assignmentForm.selectedPatternId} onChange={e => assignmentForm.setSelectedPatternId(e.target.value)} className="w-full px-3 py-2 border rounded-md dark:border-gray-600 dark:bg-gray-700"><option value="">-- Seleccionar --</option>{shiftPatterns.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></div></div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-3"><Input label="Fecha Inicio" type="date" value={assignmentForm.assignmentStartDate} onChange={e => assignmentForm.setAssignmentStartDate(e.target.value)} required/><Input label="Fecha Fin (Opcional)" type="date" value={assignmentForm.assignmentEndDate} onChange={e => assignmentForm.setAssignmentEndDate(e.target.value)}/></div>
                <div className="flex space-x-2"><Button onClick={handleSaveAssignmentForm}><PlusCircleIcon className="w-5 h-5 mr-1 inline"/> {assignmentForm.editingAssignment ? 'Actualizar' : 'Asignar'}</Button><Button variant="secondary" onClick={handleCancelAssignmentForm}>Cancelar</Button></div>
                {assignmentForm.selectedEmployeeId && assignmentForm.selectedPatternId && (<p className="text-xs mt-2 dark:text-gray-400">Horas semanales promedio calculadas para {activeEmployees.find(e=>e.id === assignmentForm.selectedEmployeeId)?.name || ''}: {calculateAverageWeeklyHoursForEmployee(assignmentForm.selectedEmployeeId, assignmentForm.editingAssignment ? undefined : { employeeId: assignmentForm.selectedEmployeeId, shiftPatternId: assignmentForm.selectedPatternId, startDate: assignmentForm.assignmentStartDate, endDate: assignmentForm.assignmentEndDate || undefined }, assignmentForm.editingAssignment?.id).toFixed(2)} hrs.</p>)}
            </div>
          )}
          <Input type="search" placeholder="Buscar por empleado o patrón..." value={assignmentSearchTerm} onChange={e => setAssignmentSearchTerm(e.target.value)} className="mb-3"/>
          {paginatedAssignments.length === 0 ? <p className="dark:text-gray-300 text-center py-4">No hay turnos asignados.</p> : (<div className="overflow-x-auto"><table className="min-w-full divide-y dark:divide-gray-700"><thead className="bg-gray-50 dark:bg-gray-700"><tr><SortableHeader title="Empleado" sortKey="employeeName" sortConfig={assignmentSortConfig as any} onSort={requestAssignmentSort as any}/><SortableHeader title="Patrón (Ciclo)" sortKey="shiftPatternName" sortConfig={assignmentSortConfig as any} onSort={requestAssignmentSort as any}/><SortableHeader title="Inicio" sortKey="startDate" sortConfig={assignmentSortConfig as any} onSort={requestAssignmentSort as any}/><SortableHeader title="Fin" sortKey="endDate" sortConfig={assignmentSortConfig as any} onSort={requestAssignmentSort as any}/><SortableHeader title="Horas Sem. Turno" sortKey="assignmentWeeklyHours" sortConfig={assignmentSortConfig as any} onSort={requestAssignmentSort as any}/><th className="px-4 py-2">Acciones</th></tr></thead><tbody className="bg-white dark:bg-gray-800 divide-y dark:divide-gray-700">{paginatedAssignments.map(as => <tr key={as.id}><td className="px-4 py-2">{as.employeeName}</td><td className="px-4 py-2">{as.shiftPatternName} ({getShiftPatternById(as.shiftPatternId)?.cycleLengthDays || 'N/A'} días)</td><td className="px-4 py-2">{new Date(as.startDate+'T00:00:00Z').toLocaleDateString('es-CL')}</td><td className="px-4 py-2">{as.endDate ? new Date(as.endDate+'T00:00:00Z').toLocaleDateString('es-CL') : 'Indefinido'}</td><td className="px-4 py-2">{as.assignmentWeeklyHours > 0 ? as.assignmentWeeklyHours.toFixed(2) : '-'}</td><td className="px-4 py-2 space-x-1"><Button size="sm" onClick={() => assignmentForm.setEditingAssignment(as)} className="p-1"><EditIcon/></Button><Button size="sm" variant="danger" onClick={() => deleteAssignedShift(as.id, actorUsername)} className="p-1"><DeleteIcon/></Button></td></tr>)}</tbody></table></div>)}
          {renderPagination(assignmentCurrentPage, totalAssignmentPages, setAssignmentCurrentPage)}
        </div>
      </div>
    </div>
  );
};

export default TheoreticalShiftsPage;
