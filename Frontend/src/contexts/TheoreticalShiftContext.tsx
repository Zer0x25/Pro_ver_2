import React, { createContext, useState, useEffect, ReactNode, useCallback, useContext } from 'react';
import { 
    TheoreticalShiftPattern, AssignedShift, TheoreticalShiftContextType, 
    DayInCycleSchedule, Employee, ScheduledEmployeeDetail, EmployeeWithShiftDetails,
    MonthlyDayScheduleView, EmployeeDailyScheduleInfo, Syncable
} from '../types';
import { idbGetAll, idbPut, idbDelete, STORES, getCounterValue, setCounterValue, COUNTER_IDS, getSettingValue } from '../utils/indexedDB'; // Added getCounterValue, setCounterValue, COUNTER_IDS
import { useLogs } from '../hooks/useLogs';
import { useToasts } from '../hooks/useToasts';
import { useEmployees } from './EmployeeContext'; 

export const TheoreticalShiftContext = createContext<TheoreticalShiftContextType | undefined>(undefined);

interface TheoreticalShiftProviderProps {
  children: ReactNode;
}

const DAYS_IN_WEEK = 7;
// const MAX_WEEKLY_HOURS = 44; // Removed hardcoded constant
const DEFAULT_PATTERN_COLOR = '#E0E0E0'; 

// Helper function to calculate hours between two HH:MM strings
export const calculateHoursBetween = (startTime?: string, endTime?: string, breakMinutes: number = 0): number => {
  if (!startTime || !endTime) return 0;

  const [startHour, startMinute] = startTime.split(':').map(Number);
  const [endHour, endMinute] = endTime.split(':').map(Number);

  if (isNaN(startHour) || isNaN(startMinute) || isNaN(endHour) || isNaN(endMinute)) return 0;


  const startDate = new Date(0, 0, 0, startHour, startMinute, 0);
  let endDate = new Date(0, 0, 0, endHour, endMinute, 0);

  if (endDate.getTime() < startDate.getTime()) { // Handles overnight shifts by adding a day
    endDate.setDate(endDate.getDate() + 1);
  }
  
  let diffMs = endDate.getTime() - startDate.getTime();
  if (diffMs < 0) return 0; 

  const breakMs = breakMinutes * 60 * 1000;
  diffMs -= breakMs;
  if (diffMs < 0) diffMs = 0; // Hours cannot be negative

  return parseFloat((diffMs / (1000 * 60 * 60)).toFixed(2)); // Convert ms to hours, round to 2 decimal
};


export const TheoreticalShiftProvider: React.FC<TheoreticalShiftProviderProps> = ({ children }) => {
  const [globalMaxWeeklyHours, setGlobalMaxWeeklyHours] = useState<number>(44); // Default, will be loaded
  const [areaList, setAreaList] = useState<string[]>([]);
  const [shiftPatterns, setShiftPatterns] = useState<TheoreticalShiftPattern[]>([]);
  const [assignedShifts, setAssignedShifts] = useState<AssignedShift[]>([]);
  const [isLoadingShifts, setIsLoadingShifts] = useState<boolean>(true);
  const { addLog } = useLogs();
  const { addToast } = useToasts();
  const { getEmployeeById, activeEmployees, isLoadingEmployees } = useEmployees();

  const enrichPatternWithHours = useCallback((pattern: TheoreticalShiftPattern): TheoreticalShiftPattern => {
    return {
      ...pattern,
      color: pattern.color || DEFAULT_PATTERN_COLOR, // Ensure color has a default
      maxHoursPattern: pattern.maxHoursPattern || globalMaxWeeklyHours, // Use globalMaxWeeklyHours
      dailySchedules: pattern.dailySchedules.map(ds => ({
        ...ds,
        startTime: ds.startTime || '', 
        endTime: ds.endTime || '',   
        isOffDay: ds.isOffDay || false,
        hasColacion: ds.hasColacion || false, 
        colacionMinutes: ds.colacionMinutes || 0, 
        hours: (ds.isOffDay || false) ? 0 : calculateHoursBetween(ds.startTime, ds.endTime, (ds.hasColacion || false) ? (ds.colacionMinutes || 0) : 0)
      }))
    };
  }, [globalMaxWeeklyHours]);


  const getEmployeeDailyScheduleInfo = useCallback((employeeId: string, targetDate: Date): EmployeeDailyScheduleInfo | null => {
    const assignmentsForEmployee = assignedShifts.filter(as => as.employeeId === employeeId);
    if (!assignmentsForEmployee.length) return null;

    const normalizedTargetDate = new Date(targetDate);
    normalizedTargetDate.setHours(0, 0, 0, 0);

    let activeAssignment: AssignedShift | null = null;
    for (const assignment of assignmentsForEmployee) {
        const assignmentStartDate = new Date(assignment.startDate + 'T00:00:00Z'); 
        
        if (normalizedTargetDate.getTime() >= assignmentStartDate.getTime()) {
             if (assignment.endDate) {
                const assignmentEndDate = new Date(assignment.endDate + 'T23:59:59Z'); 
                if (normalizedTargetDate.getTime() > assignmentEndDate.getTime()) {
                    continue; 
                }
            }
            // If this assignment is valid and starts later than the current active one, it's more relevant
            if (!activeAssignment || assignmentStartDate.getTime() > new Date(activeAssignment.startDate + 'T00:00:00Z').getTime()) {
                activeAssignment = assignment;
            }
        }
    }

    if (!activeAssignment) return { scheduleText: "Sin Turno Asignado", isWorkDay: false };
    
    const pattern = shiftPatterns.find(p => p.id === activeAssignment!.shiftPatternId); 
    if (!pattern || pattern.cycleLengthDays <= 0) return { scheduleText: "Patrón no encontrado o inválido", isWorkDay: false, shiftPatternName: activeAssignment.shiftPatternName, patternColor: DEFAULT_PATTERN_COLOR };

    const assignmentStartDateObj = new Date(activeAssignment.startDate + 'T00:00:00Z');
    
    const diffTime = normalizedTargetDate.getTime() - assignmentStartDateObj.getTime();
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    
    const dayIndexInCycle = (diffDays % pattern.cycleLengthDays + pattern.cycleLengthDays) % pattern.cycleLengthDays;
    const dailySchedule = pattern.dailySchedules.find(ds => ds.dayIndex === dayIndexInCycle);

    if (!dailySchedule) return { scheduleText: "Error en definición de patrón", isWorkDay: false, shiftPatternName: pattern.name, patternColor: pattern.color };

    if (dailySchedule.isOffDay || !dailySchedule.startTime || !dailySchedule.endTime) {
        return { scheduleText: "Libre", isWorkDay: false, shiftPatternName: pattern.name, patternColor: pattern.color };
    }
    
    const hours = dailySchedule.hours ?? calculateHoursBetween(dailySchedule.startTime, dailySchedule.endTime, dailySchedule.hasColacion ? dailySchedule.colacionMinutes : 0);
    let scheduleText = `${dailySchedule.startTime} a ${dailySchedule.endTime}`;
    if(dailySchedule.hasColacion && dailySchedule.colacionMinutes > 0){
        scheduleText += ` (Col: ${dailySchedule.colacionMinutes}m)`;
    }
    scheduleText += ` (${hours.toFixed(2)} hrs)`;

    return {
        scheduleText: scheduleText,
        isWorkDay: true,
        startTime: dailySchedule.startTime,
        endTime: dailySchedule.endTime,
        hours: hours,
        shiftPatternName: pattern.name,
        patternColor: pattern.color,
    };
  }, [assignedShifts, shiftPatterns]);


  useEffect(() => {
    if (isLoadingEmployees) return; 

    const loadData = async () => {
      setIsLoadingShifts(true);
      try {
        const storedGlobalMaxHours = await getCounterValue(COUNTER_IDS.GLOBAL_SETTING_MAX_WEEKLY_HOURS_ID, 44);
        setGlobalMaxWeeklyHours(storedGlobalMaxHours);
        
        const storedAreaList = await getSettingValue<string[]>(COUNTER_IDS.GLOBAL_AREA_LIST_ID, []);
        setAreaList(storedAreaList.sort((a,b) => a.localeCompare(b)));

        const [rawPatterns, rawAssignments] = await Promise.all([
          idbGetAll<TheoreticalShiftPattern>(STORES.THEORETICAL_SHIFT_PATTERNS),
          idbGetAll<AssignedShift>(STORES.ASSIGNED_SHIFTS),
        ]);

        const enrichedPatterns = rawPatterns.map(p => enrichPatternWithHours(p)); // Enrich uses globalMaxWeeklyHours
        setShiftPatterns(enrichedPatterns.sort((a, b) => a.name.localeCompare(b.name)));
        
        const enrichedAssignments = rawAssignments.map(assign => {
            const emp = getEmployeeById(assign.employeeId);
            const pattern = enrichedPatterns.find(p => p.id === assign.shiftPatternId);
            return {
                ...assign,
                employeeName: emp?.name || 'N/A',
                shiftPatternName: pattern?.name || 'N/A'
            };
        }).sort((a,b) => (a.employeeName || '').localeCompare(b.employeeName || '') || new Date(a.startDate).getTime() - new Date(b.startDate).getTime());

        setAssignedShifts(enrichedAssignments);

      } catch (error) {
        console.error("Error loading theoretical shifts data:", error);
        addToast("Error cargando datos de turnos teóricos.", "error");
      } finally {
        setIsLoadingShifts(false);
      }
    };
    loadData();
  }, [addToast, getEmployeeById, isLoadingEmployees, enrichPatternWithHours]);

  const updateGlobalMaxWeeklyHours = useCallback(async (newMaxHours: number, actorUsername: string): Promise<void> => {
    if (newMaxHours <= 0 || newMaxHours > 168) { // Basic validation
      addToast("Las horas máximas semanales deben ser un valor razonable (ej. 1-168).", "error");
      return;
    }
    try {
      await setCounterValue(COUNTER_IDS.GLOBAL_SETTING_MAX_WEEKLY_HOURS_ID, newMaxHours);
      setGlobalMaxWeeklyHours(newMaxHours);
      await addLog(actorUsername, 'Global Max Weekly Hours Updated', { oldValue: globalMaxWeeklyHours, newValue: newMaxHours });
      addToast(`Horas máximas semanales por ley actualizadas a ${newMaxHours}.`, 'success');
      // Re-enrich patterns if needed, or simply let subsequent loads use the new value
       setShiftPatterns(prev => prev.map(p => enrichPatternWithHours(p)));
    } catch (error) {
      console.error("Error updating global max weekly hours:", error);
      await addLog(actorUsername, 'Global Max Weekly Hours Update Failed', { error: String(error) });
      addToast("Error al actualizar las horas máximas semanales.", "error");
    }
  }, [addLog, addToast, globalMaxWeeklyHours, enrichPatternWithHours]);

    const updateAreaList = useCallback(async (newAreas: string[], actorUsername: string): Promise<void> => {
        const sortedAreas = newAreas.sort((a,b) => a.localeCompare(b));
        try {
            await setCounterValue(COUNTER_IDS.GLOBAL_AREA_LIST_ID, sortedAreas);
            setAreaList(sortedAreas);
            await addLog(actorUsername, 'Global Area List Updated', { count: sortedAreas.length });
            addToast('Lista de áreas actualizada.', 'success');
        } catch (error) {
            console.error('Error updating area list', error);
            await addLog(actorUsername, 'Global Area List Update Failed', { error: String(error) });
            addToast('Error al actualizar la lista de áreas.', 'error');
        }
    }, [addLog, addToast]);

  const getShiftPatternById = useCallback((patternId: string): TheoreticalShiftPattern | undefined => {
    return shiftPatterns.find(p => p.id === patternId);
  }, [shiftPatterns]);

  const addShiftPattern = useCallback(async (
    patternData: Omit<TheoreticalShiftPattern, 'id' | 'dailySchedules' | keyof Syncable> & { dailySchedules: Omit<DayInCycleSchedule, 'hours'>[] },
    actorUsername: string
  ): Promise<TheoreticalShiftPattern | null> => {
    try {
      const trimmedNewName = patternData.name.trim().toLowerCase();
      if (shiftPatterns.some(p => p.name.trim().toLowerCase() === trimmedNewName)) {
          addToast(`El nombre de patrón "${patternData.name.trim()}" ya existe.`, "error");
          return null;
      }

      for (const schedule of patternData.dailySchedules) {
        if (!schedule.isOffDay && (!schedule.startTime || !schedule.endTime)) {
          addToast(`El Día ${schedule.dayIndex + 1} del patrón debe tener hora de inicio y fin si no es día libre.`, "error");
          return null;
        }
        if (!schedule.isOffDay && schedule.startTime && schedule.endTime) {
            const dailyHoursNet = calculateHoursBetween(schedule.startTime, schedule.endTime, schedule.hasColacion ? schedule.colacionMinutes : 0);
            if (dailyHoursNet < 0 ) { 
                 addToast(`En el Día ${schedule.dayIndex + 1}, la hora de fin debe ser posterior a la hora de inicio (considerando colación). Un turno de 24hrs no es posible (00:00 a 00:00).`, "error");
                 return null;
            }
             if (schedule.hasColacion) {
              if (schedule.colacionMinutes <= 0) {
                addToast(`Día ${schedule.dayIndex + 1}: Minutos de colación deben ser mayor a 0 si 'Incluir Colación' está marcado.`, "error");
                return null;
              }
              const grossShiftDuration = calculateHoursBetween(schedule.startTime, schedule.endTime, 0);
              if (schedule.colacionMinutes / 60 > grossShiftDuration) {
                 addToast(`Día ${schedule.dayIndex + 1}: Los minutos de colación no pueden exceder la duración total del turno.`, "error");
                 return null;
              }
            }
        }
      }

      const rawPatternWithScheduleData: TheoreticalShiftPattern = {
        ...patternData,
        id: crypto.randomUUID(),
        dailySchedules: patternData.dailySchedules.map(ds => ({
          dayIndex: ds.dayIndex,
          startTime: ds.startTime,
          endTime: ds.endTime,
          isOffDay: ds.isOffDay,
          hasColacion: ds.hasColacion,
          colacionMinutes: ds.hasColacion ? ds.colacionMinutes : 0,
        })),
        color: patternData.color || DEFAULT_PATTERN_COLOR,
        maxHoursPattern: patternData.maxHoursPattern || globalMaxWeeklyHours, // Use globalMaxWeeklyHours
        lastModified: Date.now(),
        syncStatus: 'pending',
        isDeleted: false
      };
      
      const newPattern = enrichPatternWithHours(rawPatternWithScheduleData);

      await idbPut<TheoreticalShiftPattern>(STORES.THEORETICAL_SHIFT_PATTERNS, newPattern);
      setShiftPatterns(prev => [...prev, newPattern].sort((a, b) => a.name.localeCompare(b.name)));
      await addLog(actorUsername, 'Shift Pattern Added', { patternId: newPattern.id, name: newPattern.name, color: newPattern.color, maxHours: newPattern.maxHoursPattern });
      addToast(`Patrón de turno '${newPattern.name}' agregado.`, 'success');
      return newPattern;
    } catch (error) {
      console.error("Error adding shift pattern:", error);
      await addLog(actorUsername, 'Shift Pattern Add Failed', { name: patternData.name, error: String(error) });
      addToast("Error al agregar patrón de turno.", "error");
      return null;
    }
  }, [addLog, addToast, globalMaxWeeklyHours, enrichPatternWithHours, shiftPatterns]);

  const updateShiftPattern = useCallback(async (
    patternData: Omit<TheoreticalShiftPattern, 'dailySchedules' | keyof Syncable> & { dailySchedules: Omit<DayInCycleSchedule, 'hours'>[] },
    actorUsername: string
  ): Promise<boolean> => {
    try {
      const trimmedNewName = patternData.name.trim().toLowerCase();
      if (shiftPatterns.some(p => p.name.trim().toLowerCase() === trimmedNewName && p.id !== patternData.id)) {
          addToast(`El nombre de patrón "${patternData.name.trim()}" ya existe.`, "error");
          return false;
      }
      
      for (const schedule of patternData.dailySchedules) {
        if (!schedule.isOffDay && (!schedule.startTime || !schedule.endTime)) {
          addToast(`El Día ${schedule.dayIndex + 1} del patrón debe tener hora de inicio y fin si no es día libre.`, "error");
          return false;
        }
         if (!schedule.isOffDay && schedule.startTime && schedule.endTime) {
            const dailyHoursNet = calculateHoursBetween(schedule.startTime, schedule.endTime, schedule.hasColacion ? schedule.colacionMinutes : 0);
             if (dailyHoursNet < 0 ) {
                 addToast(`En el Día ${schedule.dayIndex + 1}, la hora de fin debe ser posterior a la hora de inicio (considerando colación). Un turno de 24hrs no es posible (00:00 a 00:00).`, "error");
                 return false;
            }
            if (schedule.hasColacion) {
              if (schedule.colacionMinutes <= 0) {
                addToast(`Día ${schedule.dayIndex + 1}: Minutos de colación deben ser mayor a 0 si 'Incluir Colación' está marcado.`, "error");
                return false;
              }
              const grossShiftDuration = calculateHoursBetween(schedule.startTime, schedule.endTime, 0);
              if (schedule.colacionMinutes / 60 > grossShiftDuration) {
                 addToast(`Día ${schedule.dayIndex + 1}: Los minutos de colación no pueden exceder la duración total del turno.`, "error");
                 return false;
              }
            }
        }
      }
      
      const rawPatternWithScheduleData: TheoreticalShiftPattern = {
        ...patternData,
        dailySchedules: patternData.dailySchedules.map(ds => ({
          dayIndex: ds.dayIndex,
          startTime: ds.startTime,
          endTime: ds.endTime,
          isOffDay: ds.isOffDay,
          hasColacion: ds.hasColacion,
          colacionMinutes: ds.hasColacion ? ds.colacionMinutes : 0,
        })),
        color: patternData.color || DEFAULT_PATTERN_COLOR,
        maxHoursPattern: patternData.maxHoursPattern || globalMaxWeeklyHours, // Use globalMaxWeeklyHours
        lastModified: Date.now(),
        syncStatus: 'pending',
        isDeleted: false,
      };

      const updatedPattern = enrichPatternWithHours(rawPatternWithScheduleData);

      await idbPut<TheoreticalShiftPattern>(STORES.THEORETICAL_SHIFT_PATTERNS, updatedPattern);
      setShiftPatterns(prev => prev.map(p => p.id === updatedPattern.id ? updatedPattern : p).sort((a, b) => a.name.localeCompare(b.name)));
      
      setAssignedShifts(prevAssignments => prevAssignments.map(assign => 
        assign.shiftPatternId === updatedPattern.id ? { ...assign, shiftPatternName: updatedPattern.name } : assign
      ));

      await addLog(actorUsername, 'Shift Pattern Updated', { patternId: updatedPattern.id, name: updatedPattern.name, color: updatedPattern.color, maxHours: updatedPattern.maxHoursPattern });
      addToast(`Patrón de turno '${updatedPattern.name}' actualizado.`, 'success');
      return true;
    } catch (error) {
      console.error("Error updating shift pattern:", error);
      await addLog(actorUsername, 'Shift Pattern Update Failed', { patternId: patternData.id, error: String(error) });
      addToast("Error al actualizar patrón de turno.", "error");
      return false;
    }
  }, [addLog, addToast, globalMaxWeeklyHours, enrichPatternWithHours, shiftPatterns]);

  const deleteShiftPattern = useCallback(async (patternId: string, actorUsername: string): Promise<boolean> => {
    const isPatternUsed = assignedShifts.some(as => as.shiftPatternId === patternId);
    if (isPatternUsed) {
      addToast("No se puede eliminar el patrón porque está asignado a uno o más empleados.", "error");
      await addLog(actorUsername, 'Shift Pattern Delete Failed - In Use', { patternId });
      return false;
    }
    const patternToDelete = shiftPatterns.find(p => p.id === patternId);
    if (!patternToDelete) {
        addToast("Patrón no encontrado para eliminar.", "error");
        return false;
    }

    try {
      await idbDelete(STORES.THEORETICAL_SHIFT_PATTERNS, patternId);
      setShiftPatterns(prev => prev.filter(p => p.id !== patternId));
      await addLog(actorUsername, 'Shift Pattern Deleted', { patternId, name: patternToDelete.name });
      addToast(`Patrón de turno '${patternToDelete.name}' eliminado.`, 'success');
      return true;
    } catch (error) {
      console.error("Error deleting shift pattern:", error);
      await addLog(actorUsername, 'Shift Pattern Delete Failed', { patternId, error: String(error) });
      addToast("Error al eliminar patrón de turno.", "error");
      return false;
    }
  }, [addLog, addToast, assignedShifts, shiftPatterns]);


  const calculateAverageWeeklyHoursForEmployee = useCallback((
    employeeId: string, 
    newAssignmentDetails?: Omit<AssignedShift, 'id' | 'employeeName' | 'shiftPatternName' | keyof Syncable>,
    assignmentToExcludeId?: string
    ): number => {
    
    let totalWeeklyContribution = 0;
    const currentAssignmentsForEmployee = assignedShifts.filter(
        as => as.employeeId === employeeId && as.id !== assignmentToExcludeId
    );

    const allRelevantAssignmentsData: Array<Pick<AssignedShift, 'shiftPatternId' >> = [...currentAssignmentsForEmployee];
    
    if (newAssignmentDetails) {
        allRelevantAssignmentsData.push({
            shiftPatternId: newAssignmentDetails.shiftPatternId,
        });
    }
    
    for (const assignmentData of allRelevantAssignmentsData) {
        const pattern = getShiftPatternById(assignmentData.shiftPatternId); // Already enriched
        if (pattern && pattern.cycleLengthDays > 0) {
            let hoursInCycle = 0;
            pattern.dailySchedules.forEach(ds => {
                if (!ds.isOffDay) {
                    hoursInCycle += ds.hours ?? calculateHoursBetween(ds.startTime, ds.endTime, ds.hasColacion ? ds.colacionMinutes : 0);
                }
            });
            const averageWeeklyHoursForThisAssignment = (hoursInCycle / pattern.cycleLengthDays) * DAYS_IN_WEEK;
            totalWeeklyContribution += averageWeeklyHoursForThisAssignment;
        }
    }
    return parseFloat(totalWeeklyContribution.toFixed(2));
  }, [assignedShifts, getShiftPatternById]);


  const assignShiftToEmployee = useCallback(async (
    assignmentData: Omit<AssignedShift, 'id' | 'employeeName' | 'shiftPatternName' | keyof Syncable>,
    actorUsername: string
  ): Promise<AssignedShift | null> => {
    
    if (assignmentData.endDate && assignmentData.startDate > assignmentData.endDate) {
        addToast("La fecha de término no puede ser anterior a la fecha de inicio.", "error");
        return null;
    }

    const weeklyHours = calculateAverageWeeklyHoursForEmployee(assignmentData.employeeId, assignmentData);
    if (weeklyHours > globalMaxWeeklyHours) { // Use globalMaxWeeklyHours
        addToast(`La asignación excede las ${globalMaxWeeklyHours} horas semanales (Calculado: ${weeklyHours.toFixed(2)} hrs).`, 'error');
        return null;
    }

    try {
      const employee = getEmployeeById(assignmentData.employeeId);
      const pattern = getShiftPatternById(assignmentData.shiftPatternId);
      if (!employee || !pattern) {
        addToast("Empleado o patrón de turno no encontrado.", "error");
        return null;
      }
      
      const newAssignment: AssignedShift = {
        ...assignmentData,
        id: crypto.randomUUID(),
        employeeName: employee.name,
        shiftPatternName: pattern.name,
        lastModified: Date.now(),
        syncStatus: 'pending',
        isDeleted: false,
      };
      await idbPut<AssignedShift>(STORES.ASSIGNED_SHIFTS, newAssignment);
      setAssignedShifts(prev => [...prev, newAssignment].sort((a,b) => (a.employeeName || '').localeCompare(b.employeeName || '') || new Date(a.startDate).getTime() - new Date(b.startDate).getTime()));
      await addLog(actorUsername, 'Shift Assigned to Employee', { assignmentId: newAssignment.id, employeeId: newAssignment.employeeId, patternId: newAssignment.shiftPatternId, startDate: newAssignment.startDate, endDate: newAssignment.endDate });
      addToast(`Turno '${pattern.name}' asignado a ${employee.name}.`, 'success');
      return newAssignment;
    } catch (error) {
      console.error("Error assigning shift:", error);
      await addLog(actorUsername, 'Shift Assign Failed', { employeeId: assignmentData.employeeId, patternId: assignmentData.shiftPatternId, error: String(error) });
      addToast("Error al asignar turno.", "error");
      return null;
    }
  }, [addLog, addToast, getEmployeeById, getShiftPatternById, calculateAverageWeeklyHoursForEmployee, globalMaxWeeklyHours]);

  const updateAssignedShift = useCallback(async (
    assignmentData: Omit<AssignedShift, 'employeeName' | 'shiftPatternName' | keyof Syncable>, 
    actorUsername: string
  ): Promise<boolean> => {
    if (assignmentData.endDate && assignmentData.startDate > assignmentData.endDate) {
        addToast("La fecha de término no puede ser anterior a la fecha de inicio.", "error");
        return false;
    }
    const weeklyHours = calculateAverageWeeklyHoursForEmployee(assignmentData.employeeId, assignmentData, assignmentData.id);
     if (weeklyHours > globalMaxWeeklyHours) { // Use globalMaxWeeklyHours
        addToast(`La actualización excede las ${globalMaxWeeklyHours} horas semanales (Calculado: ${weeklyHours.toFixed(2)} hrs).`, 'error');
        return false;
    }

    try {
      const employee = getEmployeeById(assignmentData.employeeId);
      const pattern = getShiftPatternById(assignmentData.shiftPatternId);
      if (!employee || !pattern) {
        addToast("Empleado o patrón de turno no encontrado para actualizar asignación.", "error");
        return false;
      }
      const updatedAssignment: AssignedShift = {
          ...assignmentData, 
          employeeName: employee.name,
          shiftPatternName: pattern.name,
          lastModified: Date.now(),
          syncStatus: 'pending',
          isDeleted: false,
      };
      await idbPut<AssignedShift>(STORES.ASSIGNED_SHIFTS, updatedAssignment);
      setAssignedShifts(prev => prev.map(as => as.id === updatedAssignment.id ? updatedAssignment : as).sort((a,b) => (a.employeeName || '').localeCompare(b.employeeName || '') || new Date(a.startDate).getTime() - new Date(b.startDate).getTime()));
      await addLog(actorUsername, 'Assigned Shift Updated', { assignmentId: updatedAssignment.id, startDate: updatedAssignment.startDate, endDate: updatedAssignment.endDate });
      addToast(`Asignación de turno para ${employee.name} actualizada.`, 'success');
      return true;
    } catch (error) {
      console.error("Error updating assigned shift:", error);
      await addLog(actorUsername, 'Assigned Shift Update Failed', { assignmentId: assignmentData.id, error: String(error) });
      addToast("Error al actualizar asignación de turno.", "error");
      return false;
    }
  }, [addLog, addToast, getEmployeeById, getShiftPatternById, calculateAverageWeeklyHoursForEmployee, globalMaxWeeklyHours]);

  const deleteAssignedShift = useCallback(async (assignmentId: string, actorUsername: string): Promise<boolean> => {
    const assignmentToDelete = assignedShifts.find(as => as.id === assignmentId);
     if (!assignmentToDelete) {
        addToast("Asignación no encontrada para eliminar.", "error");
        return false;
    }
    try {
      await idbDelete(STORES.ASSIGNED_SHIFTS, assignmentId);
      setAssignedShifts(prev => prev.filter(as => as.id !== assignmentId));
      await addLog(actorUsername, 'Assigned Shift Deleted', { assignmentId });
      addToast(`Asignación de turno para ${assignmentToDelete.employeeName} eliminada.`, 'success');
      return true;
    } catch (error) {
      console.error("Error deleting assigned shift:", error);
      await addLog(actorUsername, 'Assigned Shift Delete Failed', { assignmentId, error: String(error) });
      addToast("Error al eliminar asignación de turno.", "error");
      return false;
    }
  }, [addLog, addToast, assignedShifts]);

  const getAssignedShiftsByEmployee = useCallback((employeeId: string): AssignedShift[] => {
    return assignedShifts.filter(as => as.employeeId === employeeId);
  }, [assignedShifts]);
  
  const isEmployeeScheduledOnDate = useCallback(( 
    employeeId: string,
    targetDate: Date,
  ): { scheduled: boolean, shiftPatternName?: string, startTime?: string, endTime?: string, patternColor?: string } => {
    const dailyInfo = getEmployeeDailyScheduleInfo(employeeId, targetDate);
    if (dailyInfo && dailyInfo.isWorkDay) {
        return {
            scheduled: true,
            shiftPatternName: dailyInfo.shiftPatternName,
            startTime: dailyInfo.startTime,
            endTime: dailyInfo.endTime,
            patternColor: dailyInfo.patternColor,
        };
    }
    return { scheduled: false };
  }, [getEmployeeDailyScheduleInfo]);

  const getScheduledEmployeesDetailsOnDate = useCallback((targetDate: Date): ScheduledEmployeeDetail[] => { 
    const scheduledDetails: ScheduledEmployeeDetail[] = [];
    if (isLoadingEmployees) return scheduledDetails;

    activeEmployees.forEach(employee => {
      const scheduleInfo = getEmployeeDailyScheduleInfo(employee.id, targetDate);
      if (scheduleInfo && scheduleInfo.isWorkDay) {
        scheduledDetails.push({
          employeeId: employee.id,
          employeeName: employee.name,
          shiftPatternName: scheduleInfo.shiftPatternName || 'N/A',
          startTime: scheduleInfo.startTime,
          endTime: scheduleInfo.endTime,
          patternColor: scheduleInfo.patternColor,
        });
      }
    });
    return scheduledDetails.sort((a, b) => {
        if (!a.startTime) return 1;
        if (!b.startTime) return -1;
        return a.startTime.localeCompare(b.startTime);
    });
  }, [activeEmployees, getEmployeeDailyScheduleInfo, isLoadingEmployees]);

  const getEmployeesWithAssignedShifts = useCallback((): EmployeeWithShiftDetails[] => {
    if (isLoadingShifts || isLoadingEmployees) return [];
    
    return activeEmployees.map(emp => {
      const empAssignments = assignedShifts.filter(as => as.employeeId === emp.id);
      return {
        ...emp,
        assignedShiftsDetails: empAssignments.map(as => {
          const patternDetails = shiftPatterns.find(p => p.id === as.shiftPatternId);
          return {
            ...as,
            patternDetails: patternDetails ? enrichPatternWithHours(patternDetails) : undefined, 
          };
        })
      };
    }).filter(emp => emp.assignedShiftsDetails.length > 0)
      .sort((a,b) => a.name.localeCompare(b.name));
  }, [activeEmployees, assignedShifts, shiftPatterns, isLoadingShifts, isLoadingEmployees, enrichPatternWithHours]);

  const getEmployeeScheduleForMonth = useCallback((employeeId: string, year: number, month: number): MonthlyDayScheduleView[] => {
    const monthlySchedule: MonthlyDayScheduleView[] = [];
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const locale = 'es-CL';

    for (let day = 1; day <= daysInMonth; day++) {
        const currentDate = new Date(year, month, day);
        const dateIso = currentDate.toISOString().split('T')[0];
        const dayOfWeek = currentDate.toLocaleDateString(locale, { weekday: 'long' });
        const dayOfMonth = currentDate.getDate();
        
        const dailyInfo = getEmployeeDailyScheduleInfo(employeeId, currentDate);

        let scheduleText = `${dayOfWeek.charAt(0).toUpperCase() + dayOfWeek.slice(1)} ${dayOfMonth} - `;
        let isWorkDay = false;

        if (dailyInfo) {
            scheduleText += dailyInfo.scheduleText;
            isWorkDay = dailyInfo.isWorkDay;
        } else {
            scheduleText += "Sin Turno Asignado";
        }
        monthlySchedule.push({ dateIso, dayOfWeek, dayOfMonth, scheduleText, isWorkDay });
    }
    return monthlySchedule;
  }, [getEmployeeDailyScheduleInfo]);


  return (
    <TheoreticalShiftContext.Provider value={{
      globalMaxWeeklyHours,
      areaList,
      shiftPatterns,
      assignedShifts,
      isLoadingShifts,
      addShiftPattern,
      updateShiftPattern,
      deleteShiftPattern,
      getShiftPatternById,
      assignShiftToEmployee,
      updateAssignedShift,
      deleteAssignedShift,
      getAssignedShiftsByEmployee,
      calculateAverageWeeklyHoursForEmployee,
      isEmployeeScheduledOnDate,
      getScheduledEmployeesDetailsOnDate,
      getEmployeesWithAssignedShifts,
      calculateHoursBetween,
      getEmployeeScheduleForMonth,
      getEmployeeDailyScheduleInfo,
      updateGlobalMaxWeeklyHours,
      updateAreaList,
    }}>
      {children}
    </TheoreticalShiftContext.Provider>
  );
};