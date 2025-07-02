import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { TheoreticalShiftPattern, AssignedShift } from '../../types';
import { useTheoreticalShifts } from '../../hooks/useTheoreticalShifts';
import { useShiftPatternForm } from '../../hooks/useShiftPatternForm';
import { useShiftAssignmentForm } from '../../hooks/useShiftAssignmentForm';
import { useEmployees } from '../../contexts/EmployeeContext';
import { useAuth } from '../../hooks/useAuth';
import Button from '../ui/Button';
import Input from '../ui/Input';
import { PlusCircleIcon, EditIcon, DeleteIcon, ClipboardIcon, ClipboardCheckIcon, ChevronUpIcon, ChevronDownIcon, DocumentDuplicateIcon } from '../ui/icons';

const ITEMS_PER_PAGE = 5;

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

  // UI State for form visibility inside lists
  const [isPatternFormVisible, setIsPatternFormVisible] = useState(false);
  const [isAssignmentFormVisible, setIsAssignmentFormVisible] = useState(false);

  // Lists State
  const [patternSearchTerm, setPatternSearchTerm] = useState('');
  const [patternCurrentPage, setPatternCurrentPage] = useState(1);
  const [assignmentSearchTerm, setAssignmentSearchTerm] = useState('');
  const [assignmentCurrentPage, setAssignmentCurrentPage] = useState(1);

  // Sorting State
  const [patternSortConfig, setPatternSortConfig] = useState<{ key: keyof TheoreticalShiftPattern; direction: 'ascending' | 'descending' } | null>(null);
  const [assignmentSortConfig, setAssignmentSortConfig] = useState<{ key: string; direction: 'ascending' | 'descending' } | null>(null);
  
  const cardHeaderClass = "px-4 py-3 bg-gray-50 dark:bg-gray-700/50 border-b border-sap-border dark:border-gray-600 flex justify-between items-center";
  const cardBodyClass = "p-4 text-gray-800 dark:text-gray-200";
  const cardContainerClass = "bg-white dark:bg-gray-800 shadow-md rounded-lg overflow-hidden";
  const thSortableClass = "px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase cursor-pointer group select-none";

  // When editing starts, make sure the form becomes visible
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
  
  // Sorting Callbacks
  const requestPatternSort = useCallback((key: keyof TheoreticalShiftPattern) => {
    let direction: 'ascending' | 'descending' = 'ascending';
    if (patternSortConfig && patternSortConfig.key === key && patternSortConfig.direction === 'ascending') {
      direction = 'descending';
    } else if (patternSortConfig && patternSortConfig.key === key && patternSortConfig.direction === 'descending') {
      setPatternSortConfig(null);
      return;
    }
    setPatternSortConfig({ key, direction });
    setPatternCurrentPage(1);
  }, [patternSortConfig]);

  const requestAssignmentSort = useCallback((key: string) => {
    let direction: 'ascending' | 'descending' = 'ascending';
    if (assignmentSortConfig && assignmentSortConfig.key === key && assignmentSortConfig.direction === 'ascending') {
      direction = 'descending';
    } else if (assignmentSortConfig && assignmentSortConfig.key === key && assignmentSortConfig.direction === 'descending') {
      setAssignmentSortConfig(null);
      return;
    }
    setAssignmentSortConfig({ key, direction });
    setAssignmentCurrentPage(1);
  }, [assignmentSortConfig]);

  // Sort Indicator Render Functions
  const getPatternSortIndicator = (key: keyof TheoreticalShiftPattern) => {
    if (!patternSortConfig || patternSortConfig.key !== key) {
        return <ChevronDownIcon className="inline-block w-4 h-4 ml-1 text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity duration-200" />;
    }
    if (patternSortConfig.direction === 'ascending') {
        return <ChevronUpIcon className="inline-block w-4 h-4 ml-1 text-sap-blue dark:text-sap-light-blue" />;
    }
    return <ChevronDownIcon className="inline-block w-4 h-4 ml-1 text-sap-blue dark:text-sap-light-blue" />;
  };

  const getAssignmentSortIndicator = (key: string) => {
    if (!assignmentSortConfig || assignmentSortConfig.key !== key) {
        return <ChevronDownIcon className="inline-block w-4 h-4 ml-1 text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity duration-200" />;
    }
    if (assignmentSortConfig.direction === 'ascending') {
        return <ChevronUpIcon className="inline-block w-4 h-4 ml-1 text-sap-blue dark:text-sap-light-blue" />;
    }
    return <ChevronDownIcon className="inline-block w-4 h-4 ml-1 text-sap-blue dark:text-sap-light-blue" />;
  };


  // Handler functions for Pattern Form
  const handleOpenNewPatternForm = () => {
    patternForm.clearForm();
    setIsPatternFormVisible(true);
  };
  const handleCancelPatternForm = () => {
    patternForm.clearForm();
    setIsPatternFormVisible(false);
  };
  const handleSavePatternForm = async () => {
    const success = await patternForm.handleSavePattern();
    if (success) {
      setIsPatternFormVisible(false);
    }
  };
  
  // Handler functions for Assignment Form
  const handleOpenNewAssignmentForm = () => {
    assignmentForm.clearForm();
    setIsAssignmentFormVisible(true);
  };
  const handleCancelAssignmentForm = () => {
    assignmentForm.clearForm();
    setIsAssignmentFormVisible(false);
  };
  const handleSaveAssignmentForm = async () => {
    const success = await assignmentForm.handleSaveAssignment();
    if (success) {
      setIsAssignmentFormVisible(false);
    }
  };

  const processedPatterns = useMemo(() => {
    let sortableItems = shiftPatterns.filter(p => p.name.toLowerCase().includes(patternSearchTerm.toLowerCase()));
    
    if (patternSortConfig !== null) {
      sortableItems.sort((a, b) => {
        const key = patternSortConfig.key;
        const valA = a[key];
        const valB = b[key];

        if (valA === undefined || valA === null) return 1;
        if (valB === undefined || valB === null) return -1;
        
        const isAsc = patternSortConfig.direction === 'ascending';

        if (typeof valA === 'number' && typeof valB === 'number') {
           if (valA < valB) return isAsc ? -1 : 1;
           if (valA > valB) return isAsc ? 1 : -1;
           return 0;
        }

        if (typeof valA === 'string' && typeof valB === 'string') {
             return isAsc 
                ? valA.localeCompare(valB, 'es', { sensitivity: 'base' }) 
                : valB.localeCompare(valA, 'es', { sensitivity: 'base' });
        }
        
        if (valA < valB) return isAsc ? -1 : 1;
        if (valA > valB) return isAsc ? 1 : -1;
        return 0;
      });
    }
    
    return sortableItems;
  }, [shiftPatterns, patternSearchTerm, patternSortConfig]);

  const paginatedPatterns = useMemo(() => {
    const startIndex = (patternCurrentPage - 1) * ITEMS_PER_PAGE;
    return processedPatterns.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  }, [processedPatterns, patternCurrentPage]);
  const totalPatternPages = Math.ceil(processedPatterns.length / ITEMS_PER_PAGE);

  const processedAssignments = useMemo(() => {
    const assignmentsWithHours = assignedShifts.map(as => {
        const pattern = getShiftPatternById(as.shiftPatternId);
        let assignmentWeeklyHours = 0;
        if (pattern && pattern.cycleLengthDays > 0) {
            let totalHoursInCycle = 0;
            pattern.dailySchedules.forEach(ds => {
                if (!ds.isOffDay && ds.hours) {
                    totalHoursInCycle += ds.hours;
                }
            });
            assignmentWeeklyHours = (totalHoursInCycle / pattern.cycleLengthDays) * 7;
        }
        return { ...as, assignmentWeeklyHours };
    });

    let sortableItems = assignmentsWithHours.filter(as => 
        (as.employeeName?.toLowerCase() || '').includes(assignmentSearchTerm.toLowerCase()) ||
        (as.shiftPatternName?.toLowerCase() || '').includes(assignmentSearchTerm.toLowerCase())
    );
    
    if (assignmentSortConfig !== null) {
      sortableItems.sort((a, b) => {
        const key = assignmentSortConfig.key as keyof typeof sortableItems[0];
        const valA = a[key];
        const valB = b[key];
        const isAsc = assignmentSortConfig.direction === 'ascending';

        const emptyA = valA === undefined || valA === null || valA === '';
        const emptyB = valB === undefined || valB === null || valB === '';
        if (emptyA && emptyB) return 0;
        if (emptyA) return 1;
        if (emptyB) return -1;

        if (typeof valA === 'number' && typeof valB === 'number') {
           if (valA < valB) return isAsc ? -1 : 1;
           if (valA > valB) return isAsc ? 1 : -1;
           return 0;
        }

        if (typeof valA === 'string' && typeof valB === 'string') {
             return isAsc 
                ? valA.localeCompare(valB, 'es', { sensitivity: 'base' }) 
                : valB.localeCompare(valA, 'es', { sensitivity: 'base' });
        }
        
        if (valA < valB) return isAsc ? -1 : 1;
        if (valA > valB) return isAsc ? 1 : -1;
        return 0;
      });
    }

    return sortableItems;
  }, [assignedShifts, assignmentSearchTerm, getShiftPatternById, assignmentSortConfig]);

  const paginatedAssignments = useMemo(() => {
    const startIndex = (assignmentCurrentPage - 1) * ITEMS_PER_PAGE;
    return processedAssignments.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  }, [processedAssignments, assignmentCurrentPage]);
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

  if (isLoadingShifts || isLoadingEmployees) {
    return <div className="p-6 text-center dark:text-gray-200">Cargando datos de turnos...</div>;
  }
  
  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-semibold text-gray-800 dark:text-gray-100">Gestión de Turnos Teóricos</h1>

      {/* Section 1: Manage Shift Patterns */}
      <div id="pattern-form-section" className={cardContainerClass}>
        <div className={cardHeaderClass}>
            <h3 className="text-lg font-medium leading-6 text-sap-dark-gray dark:text-gray-100">
                Patrones de Turno
            </h3>
            {!isPatternFormVisible && (
              <Button onClick={handleOpenNewPatternForm} size="sm" className="flex items-center">
                  <PlusCircleIcon className="w-5 h-5 mr-1" />
                  Crear Nuevo Patrón
              </Button>
            )}
        </div>
        <div className={cardBodyClass}>
          {isPatternFormVisible && (
            <div className="border-b-2 border-dashed border-gray-300 dark:border-gray-600 mb-4 pb-4">
              <h3 className="text-lg font-semibold mb-3">{patternForm.editingPattern ? 'Editar Patrón de Turno' : 'Nuevo Patrón de Turno'}</h3>
              <div className="grid grid-cols-1 md:grid-cols-6 gap-4 mb-3 items-end">
                  <div className="md:col-span-3">
                    <Input label="Nombre del Patrón" value={patternForm.patternName} onChange={e => patternForm.setPatternName(e.target.value)} />
                  </div>
                  <div className="md:col-span-1">
                    <Input label="Ciclo (días)" type="number" min="1" max="99" value={String(patternForm.patternCycleLength)} onChange={e => patternForm.setPatternCycleLength(parseInt(e.target.value, 10) || 1)} />
                  </div>
                  <div className="md:col-span-1">
                    <Input 
                      label="Max Hrs/Sem" 
                      type="number" 
                      min="1" 
                      value={String(patternForm.patternMaxHoursInput)} 
                      onChange={e => patternForm.setPatternMaxHoursInput(parseInt(e.target.value, 10) || globalMaxWeeklyHours)} 
                      title="Máximas Horas Semanales del Patrón"
                    />
                  </div>
                  <div className="md:col-span-1">
                    <label htmlFor="patternColor" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Color</label>
                    <input 
                      type="color" 
                      id="patternColor" 
                      value={patternForm.patternColor} 
                      onChange={e => patternForm.setPatternColor(e.target.value)}
                      className="w-full h-10 px-1 py-1 border border-sap-border dark:border-gray-600 rounded-md shadow-sm bg-white dark:bg-gray-700 focus:ring-sap-blue focus:border-sap-blue"
                      title="Color del Patrón"
                    />
                  </div>
              </div>
              <p className={`text-xs mb-3 ${patternForm.calculatedPatternWeeklyHours > patternForm.patternMaxHoursInput ? 'text-red-500 dark:text-red-400 font-semibold' : 'text-gray-600 dark:text-gray-400'}`}>
                  Horas Semanales Calculadas para este patrón: {patternForm.calculatedPatternWeeklyHours.toFixed(2)} hrs
              </p>
              
              <h4 className="text-md font-semibold mt-4 mb-2 text-gray-700 dark:text-gray-300">Horarios Diarios del Ciclo:</h4>
              <div className="grid grid-cols-1 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7 gap-3">
                {patternForm.patternDailySchedules.map((schedule, index) => (
                  <div key={index} className="p-3 border rounded-md dark:border-gray-700 bg-gray-50 dark:bg-gray-700/50 flex flex-col min-w-[11rem]">
                    {/* Day Header */}
                    <div className="flex justify-between items-center mb-3">
                      <p className="font-medium text-sm text-gray-800 dark:text-gray-200">Día {schedule.dayIndex + 1}</p>
                      <div className="space-x-1">
                        <Button onClick={() => patternForm.handleCopyDailySchedule(index)} size="sm" variant="secondary" className="p-1" title="Copiar horario"><ClipboardIcon className="w-4 h-4" /></Button>
                        <Button onClick={() => patternForm.handlePasteDailySchedule(index)} size="sm" variant="secondary" className="p-1" title="Pegar horario" disabled={!patternForm.copiedDailySchedule}><ClipboardCheckIcon className="w-4 h-4" /></Button>
                      </div>
                    </div>
                    
                    {/* Main Content Area */}
                    <div className="space-y-3 flex-grow">
                      <label className="flex items-center space-x-2 text-sm dark:text-gray-200 cursor-pointer">
                        <input type="checkbox" checked={schedule.isOffDay} onChange={e => patternForm.handleDailyScheduleChange(index, 'isOffDay', e.target.checked)} className="form-checkbox h-4 w-4 text-sap-blue focus:ring-sap-blue dark:bg-gray-600 dark:border-gray-500"/>
                        <span>Día Libre</span>
                      </label>
                      
                      <div className="space-y-2">
                          <Input label="Inicio" type="time" value={schedule.startTime || ''} onChange={e => patternForm.handleDailyScheduleChange(index, 'startTime', e.target.value)} disabled={schedule.isOffDay} className="text-sm w-full"/>
                          <Input label="Fin" type="time" value={schedule.endTime || ''} onChange={e => patternForm.handleDailyScheduleChange(index, 'endTime', e.target.value)} disabled={schedule.isOffDay} className="text-sm w-full"/>
                      </div>

                      {!schedule.isOffDay && (
                        <div className="space-y-2 pt-2 border-t border-gray-200 dark:border-gray-600">
                          <label className="flex items-center space-x-2 text-sm dark:text-gray-200 cursor-pointer">
                            <input type="checkbox" checked={schedule.hasColacion} onChange={e => patternForm.handleDailyScheduleChange(index, 'hasColacion', e.target.checked)} disabled={schedule.isOffDay} className="form-checkbox h-4 w-4 text-sap-blue focus:ring-sap-blue dark:bg-gray-600 dark:border-gray-500"/>
                            <span>Incluir Colación</span>
                          </label>
                          <Input label="Minutos Col." type="number" min="0" value={String(schedule.colacionMinutes)} onChange={e => patternForm.handleDailyScheduleChange(index, 'colacionMinutes', parseInt(e.target.value, 10) || 0)} disabled={schedule.isOffDay || !schedule.hasColacion} className="text-sm w-full"/>
                        </div>
                      )}
                    </div>

                    {/* Footer / Summary */}
                    <div className="mt-auto pt-3">
                       <p className="text-xs text-center text-gray-600 dark:text-gray-400 border-t border-gray-200 dark:border-gray-600 pt-2">
                           Horas Netas: <span className="font-semibold">{schedule.hours?.toFixed(2) || '0.00'}</span>
                       </p>
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex space-x-2 mt-4"><Button onClick={handleSavePatternForm}><PlusCircleIcon className="w-5 h-5 mr-1 inline"/> {patternForm.editingPattern ? 'Actualizar' : 'Guardar'} Patrón</Button><Button variant="secondary" onClick={handleCancelPatternForm}>Cancelar</Button></div>
            </div>
          )}
          <Input type="search" placeholder="Buscar patrones..." value={patternSearchTerm} onChange={e => setPatternSearchTerm(e.target.value)} className="mb-3" />
          {paginatedPatterns.length === 0 ? <p className="dark:text-gray-300 text-center py-4">No hay patrones de turno.</p> : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                <thead className="bg-gray-50 dark:bg-gray-700">
                  <tr>
                    <th className={thSortableClass} onDoubleClick={() => requestPatternSort('name')}>
                        <div className="flex items-center">Nombre{getPatternSortIndicator('name')}</div>
                    </th>
                    <th className={thSortableClass} onDoubleClick={() => requestPatternSort('cycleLengthDays')}>
                        <div className="flex items-center">Ciclo (días){getPatternSortIndicator('cycleLengthDays')}</div>
                    </th>
                    <th className={thSortableClass} onDoubleClick={() => requestPatternSort('maxHoursPattern')}>
                        <div className="flex items-center">Max Hrs Patrón{getPatternSortIndicator('maxHoursPattern')}</div>
                    </th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Color</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Acciones</th>
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">{paginatedPatterns.map(p => (<tr key={p.id}><td className="px-4 py-2 whitespace-nowrap dark:text-gray-200">{p.name}</td><td className="px-4 py-2 whitespace-nowrap dark:text-gray-200">{p.cycleLengthDays}</td><td className="px-4 py-2 whitespace-nowrap dark:text-gray-200">{p.maxHoursPattern?.toFixed(2) || globalMaxWeeklyHours}</td><td className="px-4 py-2 whitespace-nowrap"><div style={{ backgroundColor: p.color || 'transparent', width: '20px', height: '20px', borderRadius: '50%', border: '1px solid #ccc' }} title={p.color}></div></td>
                <td className="px-4 py-2 whitespace-nowrap space-x-1">
                  <Button size="sm" onClick={() => patternForm.setEditingPattern(p)} className="p-1" title="Editar Patrón"><EditIcon /></Button>
                  <Button size="sm" variant="secondary" onClick={() => { patternForm.startCopyOfPattern(p); setIsPatternFormVisible(true); }} className="p-1" title="Copiar Patrón"><DocumentDuplicateIcon /></Button>
                  <Button size="sm" variant="danger" onClick={() => deleteShiftPattern(p.id, actorUsername)} className="p-1" title="Eliminar Patrón"><DeleteIcon /></Button>
                </td>
                </tr>))}</tbody></table>
            </div>
          )}
          {renderPagination(patternCurrentPage, totalPatternPages, setPatternCurrentPage)}
        </div>
      </div>

      {/* Section 2: Assign Shifts to Employees */}
      <div id="assignment-form-section" className={cardContainerClass}>
        <div className={cardHeaderClass}>
            <h3 className="text-lg font-medium leading-6 text-sap-dark-gray dark:text-gray-100">
                Asignaciones de Turnos
            </h3>
            {!isAssignmentFormVisible && (
              <Button onClick={handleOpenNewAssignmentForm} size="sm" className="flex items-center">
                  <PlusCircleIcon className="w-5 h-5 mr-1" />
                  Asignar Nuevo Turno
              </Button>
            )}
        </div>
        <div className={cardBodyClass}>
          {isAssignmentFormVisible && (
            <div className="border-b-2 border-dashed border-gray-300 dark:border-gray-600 mb-4 pb-4">
                <h3 className="text-lg font-semibold mb-3">{assignmentForm.editingAssignment ? 'Editar Asignación de Turno' : 'Nueva Asignación de Turno'}</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-3"><div><label htmlFor="employeeSelect" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Empleado Activo:</label><select id="employeeSelect" value={assignmentForm.selectedEmployeeId} onChange={e => assignmentForm.setSelectedEmployeeId(e.target.value)} className="block w-full px-3 py-2 border border-sap-border dark:border-gray-600 rounded-md shadow-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-sap-blue focus:border-sap-blue sm:text-sm"><option value="">-- Seleccionar Empleado --</option>{activeEmployees.map(emp => <option key={emp.id} value={emp.id}>{emp.name}</option>)}</select></div><div><label htmlFor="patternSelect" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Patrón de Turno:</label><select id="patternSelect" value={assignmentForm.selectedPatternId} onChange={e => assignmentForm.setSelectedPatternId(e.target.value)} className="block w-full px-3 py-2 border border-sap-border dark:border-gray-600 rounded-md shadow-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-sap-blue focus:border-sap-blue sm:text-sm"><option value="">-- Seleccionar Patrón --</option>{shiftPatterns.map(p => <option key={p.id} value={p.id}>{p.name} (Ciclo: {p.cycleLengthDays} días)</option>)}</select></div></div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-3"><Input label="Fecha de Inicio Asignación" type="date" value={assignmentForm.assignmentStartDate} onChange={e => assignmentForm.setAssignmentStartDate(e.target.value)} required/><Input label="Fecha de Término (Opcional)" type="date" value={assignmentForm.assignmentEndDate} onChange={e => assignmentForm.setAssignmentEndDate(e.target.value)} /></div>
                <div className="flex space-x-2"><Button onClick={handleSaveAssignmentForm}><PlusCircleIcon className="w-5 h-5 mr-1 inline"/> {assignmentForm.editingAssignment ? 'Actualizar' : 'Asignar'} Turno</Button><Button variant="secondary" onClick={handleCancelAssignmentForm}>Cancelar</Button></div>
                {assignmentForm.selectedEmployeeId && assignmentForm.selectedPatternId && (<p className="text-xs mt-2 text-gray-600 dark:text-gray-400">Horas semanales promedio calculadas para {activeEmployees.find(e=>e.id === assignmentForm.selectedEmployeeId)?.name || 'empleado'}: {calculateAverageWeeklyHoursForEmployee(assignmentForm.selectedEmployeeId, assignmentForm.editingAssignment ? undefined : { employeeId: assignmentForm.selectedEmployeeId, shiftPatternId: assignmentForm.selectedPatternId, startDate: assignmentForm.assignmentStartDate, endDate: assignmentForm.assignmentEndDate || undefined }, assignmentForm.editingAssignment?.id).toFixed(2)} hrs. (Máx legal: {globalMaxWeeklyHours} hrs)</p>)}
            </div>
          )}
          <Input type="search" placeholder="Buscar por empleado o patrón..." value={assignmentSearchTerm} onChange={e => setAssignmentSearchTerm(e.target.value)} className="mb-3" />
          {paginatedAssignments.length === 0 ? <p className="dark:text-gray-300 text-center py-4">No hay turnos asignados.</p> : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                <thead className="bg-gray-50 dark:bg-gray-700">
                  <tr>
                    <th className={thSortableClass} onDoubleClick={() => requestAssignmentSort('employeeName')}>
                        <div className="flex items-center">Empleado{getAssignmentSortIndicator('employeeName')}</div>
                    </th>
                    <th className={thSortableClass} onDoubleClick={() => requestAssignmentSort('shiftPatternName')}>
                        <div className="flex items-center">Patrón (Ciclo){getAssignmentSortIndicator('shiftPatternName')}</div>
                    </th>
                    <th className={thSortableClass} onDoubleClick={() => requestAssignmentSort('startDate')}>
                        <div className="flex items-center">Inicio{getAssignmentSortIndicator('startDate')}</div>
                    </th>
                    <th className={thSortableClass} onDoubleClick={() => requestAssignmentSort('endDate')}>
                        <div className="flex items-center">Fin{getAssignmentSortIndicator('endDate')}</div>
                    </th>
                    <th className={thSortableClass} onDoubleClick={() => requestAssignmentSort('assignmentWeeklyHours')}>
                        <div className="flex items-center">Horas Sem. Turno{getAssignmentSortIndicator('assignmentWeeklyHours')}</div>
                    </th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Acciones</th>
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                  {paginatedAssignments.map(as => {
                    const pattern = getShiftPatternById(as.shiftPatternId);
                    return (
                      <tr key={as.id}>
                        <td className="px-4 py-2 whitespace-nowrap dark:text-gray-200">{as.employeeName}</td>
                        <td className="px-4 py-2 whitespace-nowrap dark:text-gray-200">{as.shiftPatternName} ({pattern?.cycleLengthDays || 'N/A'} días)</td>
                        <td className="px-4 py-2 whitespace-nowrap dark:text-gray-200">{new Date(as.startDate+'T00:00:00Z').toLocaleDateString('es-CL')}</td>
                        <td className="px-4 py-2 whitespace-nowrap dark:text-gray-200">{as.endDate ? new Date(as.endDate+'T00:00:00Z').toLocaleDateString('es-CL') : 'Indefinido'}</td>
                        <td className="px-4 py-2 whitespace-nowrap dark:text-gray-200">{as.assignmentWeeklyHours > 0 ? as.assignmentWeeklyHours.toFixed(2) : '-'}</td>
                        <td className="px-4 py-2 whitespace-nowrap space-x-1">
                          <Button size="sm" onClick={() => assignmentForm.setEditingAssignment(as)} className="p-1"><EditIcon /></Button>
                          <Button size="sm" variant="danger" onClick={() => deleteAssignedShift(as.id, actorUsername)} className="p-1"><DeleteIcon /></Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
          {renderPagination(assignmentCurrentPage, totalAssignmentPages, setAssignmentCurrentPage)}
        </div>
      </div>
      
    </div>
  );
};

export default TheoreticalShiftsPage;