import React, { createContext, useState, useEffect, ReactNode, useCallback, useContext, useRef } from 'react';
import { 
    TheoreticalShiftPattern, AssignedShift, TheoreticalShiftContextType, 
    DayInCycleSchedule, Employee, ScheduledEmployeeDetail, EmployeeWithShiftDetails,
    MonthlyDayScheduleView, EmployeeDailyScheduleInfo, Syncable, MeterConfig, AppSetting
} from '../types';
import { idbGetAll, idbPut, idbDelete, STORES, getCounterValue, setCounterValue, COUNTER_IDS, getSettingValue, idbGet } from '../utils/indexedDB'; // Added getCounterValue, setCounterValue, COUNTER_IDS
import { useLogs } from '../hooks/useLogs';
import { useToasts } from '../hooks/useToasts';
import { useEmployees } from './EmployeeContext'; 
import { calculateHoursBetween } from '../utils/calculations';


export const TheoreticalShiftContext = createContext<TheoreticalShiftContextType | undefined>(undefined);

interface TheoreticalShiftProviderProps {
  children: ReactNode;
}

const DAYS_IN_WEEK = 7;
// const MAX_WEEKLY_HOURS = 44; // Removed hardcoded constant
const DEFAULT_PATTERN_COLOR = '#E0E0E0'; 

export const TheoreticalShiftProvider: React.FC<TheoreticalShiftProviderProps> = ({ children }) => {
  const [globalMaxWeeklyHours, setGlobalMaxWeeklyHours] = useState<number>(44); // Default, will be loaded
  const [areaList, setAreaList] = useState<string[]>([]);
  const [meterConfigs, setMeterConfigs] = useState<MeterConfig[]>([]);
  const [shiftPatterns, setShiftPatterns] = useState<TheoreticalShiftPattern[]>([]);
  const [assignedShifts, setAssignedShifts] = useState<AssignedShift[]>([]);
  const [isLoadingShifts, setIsLoadingShifts] = useState<boolean>(true);

  const shiftPatternsRef = useRef(shiftPatterns);
  shiftPatternsRef.current = shiftPatterns;
  const assignedShiftsRef = useRef(assignedShifts);
  assignedShiftsRef.current = assignedShifts;

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
    const assignmentsForEmployee = assignedShiftsRef.current.filter(as => as.employeeId === employeeId);
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

    if (!activeAssignment) return { scheduleText: "Sin Turno Asignado", isWorkDay: false, hasColacion: false, colacionMinutes: 0 };
    
    const pattern = shiftPatternsRef.current.find(p => p.id === activeAssignment!.shiftPatternId); 
    if (!pattern || pattern.cycleLengthDays <= 0) return { scheduleText: "Patrón no encontrado o inválido", isWorkDay: false, shiftPatternName: activeAssignment.shiftPatternName, patternColor: DEFAULT_PATTERN_COLOR, hasColacion: false, colacionMinutes: 0 };

    const assignmentStartDateObj = new Date(activeAssignment.startDate + 'T00:00:00Z');
    
    const diffTime = normalizedTargetDate.getTime() - assignmentStartDateObj.getTime();
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    
    const dayIndexInCycle = (diffDays % pattern.cycleLengthDays + pattern.cycleLengthDays) % pattern.cycleLengthDays;
    const dailySchedule = pattern.dailySchedules.find(ds => ds.dayIndex === dayIndexInCycle);

    if (!dailySchedule) return { scheduleText: "Error en definición de patrón", isWorkDay: false, shiftPatternName: pattern.name, patternColor: pattern.color, hasColacion: false, colacionMinutes: 0 };

    if (dailySchedule.isOffDay || !dailySchedule.startTime || !dailySchedule.endTime) {
        return { scheduleText: "Libre", isWorkDay: false, shiftPatternName: pattern.name, patternColor: pattern.color, hasColacion: false, colacionMinutes: 0 };
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
        hasColacion: dailySchedule.hasColacion,
        colacionMinutes: dailySchedule.colacionMinutes,
    };
  }, []);


  useEffect(() => {
    if (isLoadingEmployees) return; 

    const loadData = async () => {
      setIsLoadingShifts(true);
      try {
        const storedGlobalMaxHours = await getCounterValue(COUNTER_IDS.GLOBAL_SETTING_MAX_WEEKLY_HOURS_ID, 44);
        setGlobalMaxWeeklyHours(storedGlobalMaxHours);
        
        // --- NEW DYNAMIC AREA LIST LOGIC ---
        const areaSetting = await idbGet<AppSetting>(STORES.APP_SETTINGS, COUNTER_IDS.GLOBAL_AREA_LIST_ID);
        let finalAreaList: string[];

        if (areaSetting && Array.isArray(areaSetting.value) && areaSetting.value.length > 0) {
            // A list has been explicitly saved by the user. Use it.
            finalAreaList = areaSetting.value;
        } else {
            // No list saved, or it's empty. Generate from employees.
            if (activeEmployees.length > 0) {
                const areasFromEmployees = [...new Set(activeEmployees.map(emp => emp.area).filter(Boolean))];
                if (areasFromEmployees.length > 0) {
                    finalAreaList = areasFromEmployees;
                } else {
                    // Employees exist, but none have an area assigned.
                    finalAreaList = ['Otros'];
                }
            } else {
                // No employees to scan from, use default.
                finalAreaList = ['Otros'];
            }
        }
        setAreaList(finalAreaList.sort((a,b) => a.localeCompare(b)));
        // --- END DYNAMIC AREA LIST LOGIC ---
        
        const defaultMeters: MeterConfig[] = [
            { id: 'd5a2d8a1-4e78-4f8e-a9a3-1f1d1b1c1d1e', label: 'Medidor Agua' },
            { id: 'e8b3b8b2-5f8e-4a9d-b1c1-2f2d2e2f2g2h', label: 'Medidor Luz' }
        ];
        const storedMeterConfigs = await getSettingValue<MeterConfig[]>(COUNTER_IDS.GLOBAL_METER_CONFIGS_ID, defaultMeters);
        setMeterConfigs(storedMeterConfigs.sort((a,b) => a.label.localeCompare(b.label)));

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
  }, [addToast, getEmployeeById, isLoadingEmployees, enrichPatternWithHours, activeEmployees]);

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

    const updateMeterConfigs = useCallback(async (newConfigs: MeterConfig[], actorUsername: string): Promise<void> => {
      const sortedConfigs = newConfigs.sort((a,b) => a.label.localeCompare(b.label));
      try {
          await setCounterValue(COUNTER_IDS.GLOBAL_METER_CONFIGS_ID, sortedConfigs);
          setMeterConfigs(sortedConfigs);
          await addLog(actorUsername, 'Global Meter Configs Updated', { count: sortedConfigs.length });
          addToast('Configuración de medidores actualizada.', 'success');
      } catch (error) {
            console.error('Error updating meter configs', error);
            await addLog(actorUsername, 'Global Meter Configs Update Failed', { error: String(error) });
            addToast('Error al actualizar la configuración de medidores.', 'error');
        }
    }, [addLog, addToast]);

    const addShiftPattern = useCallback(async (patternData: Omit<TheoreticalShiftPattern, 'id' | 'dailySchedules' | keyof Syncable> & { dailySchedules: Omit<DayInCycleSchedule, 'hours'>[] }, actorUsername: string): Promise<TheoreticalShiftPattern | null> => {
        const newPattern: TheoreticalShiftPattern = enrichPatternWithHours({
            ...patternData,
            id: crypto.randomUUID(),
            lastModified: Date.now(),
            syncStatus: 'pending',
            isDeleted: false
        });

        try {
            await idbPut<TheoreticalShiftPattern>(STORES.THEORETICAL_SHIFT_PATTERNS, newPattern);
            setShiftPatterns(prev => [...prev, newPattern].sort((a, b) => a.name.localeCompare(b.name)));
            await addLog(actorUsername, 'Shift Pattern Added', { patternId: newPattern.id, name: newPattern.name });
            addToast(`Patrón '${newPattern.name}' agregado.`, 'success');
            return newPattern;
        } catch (error) {
            console.error("Error adding shift pattern:", error);
            await addLog(actorUsername, 'Shift Pattern Add Failed', { name: newPattern.name, error: String(error) });
            addToast(`Error al agregar el patrón '${newPattern.name}'.`, 'error');
            return null;
        }
    }, [addLog, addToast, enrichPatternWithHours]);
    
    const updateShiftPattern = useCallback(async (patternData: Omit<TheoreticalShiftPattern, 'dailySchedules' | keyof Syncable> & { dailySchedules: Omit<DayInCycleSchedule, 'hours'>[] }, actorUsername: string): Promise<boolean> => {
        const patternToUpdate = shiftPatternsRef.current.find(p => p.id === patternData.id);
        if (!patternToUpdate) return false;
        
        const updatedPattern = enrichPatternWithHours({
            ...patternToUpdate,
            ...patternData,
            lastModified: Date.now(),
            syncStatus: 'pending'
        });

        try {
            await idbPut<TheoreticalShiftPattern>(STORES.THEORETICAL_SHIFT_PATTERNS, updatedPattern);
            setShiftPatterns(prev => prev.map(p => p.id === updatedPattern.id ? updatedPattern : p).sort((a, b) => a.name.localeCompare(b.name)));
            await addLog(actorUsername, 'Shift Pattern Updated', { patternId: updatedPattern.id, name: updatedPattern.name });
            addToast(`Patrón '${updatedPattern.name}' actualizado.`, 'success');
            return true;
        } catch (error) {
            console.error("Error updating shift pattern:", error);
            await addLog(actorUsername, 'Shift Pattern Update Failed', { patternId: updatedPattern.id, name: updatedPattern.name, error: String(error) });
            addToast(`Error al actualizar el patrón '${updatedPattern.name}'.`, 'error');
            return false;
        }
    }, [addLog, addToast, enrichPatternWithHours]);

    const deleteShiftPattern = useCallback(async (patternId: string, actorUsername: string): Promise<boolean> => {
        const assignmentsUsingPattern = assignedShiftsRef.current.filter(a => a.shiftPatternId === patternId);
        if (assignmentsUsingPattern.length > 0) {
            addToast('No se puede eliminar. El patrón está asignado a uno o más empleados.', 'error');
            return false;
        }

        try {
            await idbDelete(STORES.THEORETICAL_SHIFT_PATTERNS, patternId);
            setShiftPatterns(prev => prev.filter(p => p.id !== patternId));
            await addLog(actorUsername, 'Shift Pattern Deleted', { patternId });
            addToast('Patrón de turno eliminado.', 'success');
            return true;
        } catch (error) {
            console.error("Error deleting shift pattern:", error);
            await addLog(actorUsername, 'Shift Pattern Delete Failed', { patternId, error: String(error) });
            addToast('Error al eliminar el patrón.', 'error');
            return false;
        }
    }, [addLog, addToast]);
    
    const getShiftPatternById = useCallback((patternId: string): TheoreticalShiftPattern | undefined => {
        return shiftPatternsRef.current.find(p => p.id === patternId);
    }, []);
    
    const assignShiftToEmployee = useCallback(async (assignmentData: Omit<AssignedShift, 'id' | 'employeeName' | 'shiftPatternName' | keyof Syncable>, actorUsername: string): Promise<AssignedShift | null> => {
        const emp = getEmployeeById(assignmentData.employeeId);
        const pattern = getShiftPatternById(assignmentData.shiftPatternId);
        if (!emp || !pattern) {
            addToast('Empleado o patrón no válido.', 'error');
            return null;
        }
        
        const newAssignment: AssignedShift = {
            ...assignmentData,
            id: crypto.randomUUID(),
            employeeName: emp.name,
            shiftPatternName: pattern.name,
            lastModified: Date.now(),
            syncStatus: 'pending',
            isDeleted: false,
        };
        try {
            await idbPut<AssignedShift>(STORES.ASSIGNED_SHIFTS, newAssignment);
            setAssignedShifts(prev => [...prev, newAssignment].sort((a,b) => (a.employeeName || '').localeCompare(b.employeeName || '') || new Date(a.startDate).getTime() - new Date(b.startDate).getTime()));
            await addLog(actorUsername, 'Shift Assigned to Employee', { employeeId: emp.id, patternId: pattern.id, assignmentId: newAssignment.id });
            addToast(`Turno asignado a ${emp.name}.`, 'success');
            return newAssignment;
        } catch (error) {
            console.error("Error assigning shift:", error);
            await addLog(actorUsername, 'Shift Assign Failed', { error: String(error) });
            addToast('Error al asignar el turno.', 'error');
            return null;
        }
    }, [addLog, addToast, getEmployeeById, getShiftPatternById]);
    
    const updateAssignedShift = useCallback(async (assignmentData: Omit<AssignedShift, 'employeeName' | 'shiftPatternName' | keyof Syncable>, actorUsername: string): Promise<boolean> => {
        const assignmentToUpdate = assignedShiftsRef.current.find(a => a.id === assignmentData.id);
        if (!assignmentToUpdate) return false;
        
        const emp = getEmployeeById(assignmentData.employeeId);
        const pattern = getShiftPatternById(assignmentData.shiftPatternId);
        if (!emp || !pattern) {
            addToast('Empleado o patrón no válido.', 'error');
            return false;
        }

        const updatedAssignment: AssignedShift = {
            ...assignmentToUpdate,
            ...assignmentData,
            employeeName: emp.name,
            shiftPatternName: pattern.name,
            lastModified: Date.now(),
            syncStatus: 'pending',
        };
        
        try {
            await idbPut<AssignedShift>(STORES.ASSIGNED_SHIFTS, updatedAssignment);
            setAssignedShifts(prev => prev.map(a => a.id === updatedAssignment.id ? updatedAssignment : a).sort((a,b) => (a.employeeName || '').localeCompare(b.employeeName || '') || new Date(a.startDate).getTime() - new Date(b.startDate).getTime()));
            await addLog(actorUsername, 'Assigned Shift Updated', { assignmentId: updatedAssignment.id });
            addToast(`Asignación para ${emp.name} actualizada.`, 'success');
            return true;
        } catch (error) {
            console.error("Error updating assigned shift:", error);
            await addLog(actorUsername, 'Assigned Shift Update Failed', { assignmentId: updatedAssignment.id, error: String(error) });
            addToast('Error al actualizar la asignación.', 'error');
            return false;
        }
    }, [addLog, addToast, getEmployeeById, getShiftPatternById]);
    
    const deleteAssignedShift = useCallback(async (assignmentId: string, actorUsername: string): Promise<boolean> => {
        try {
            await idbDelete(STORES.ASSIGNED_SHIFTS, assignmentId);
            setAssignedShifts(prev => prev.filter(a => a.id !== assignmentId));
            await addLog(actorUsername, 'Assigned Shift Deleted', { assignmentId });
            addToast('Asignación de turno eliminada.', 'success');
            return true;
        } catch (error) {
            console.error("Error deleting assigned shift:", error);
            await addLog(actorUsername, 'Assigned Shift Delete Failed', { assignmentId, error: String(error) });
            addToast('Error al eliminar la asignación.', 'error');
            return false;
        }
    }, [addLog, addToast]);
    
    const getAssignedShiftsByEmployee = useCallback((employeeId: string): AssignedShift[] => {
        return assignedShiftsRef.current.filter(a => a.employeeId === employeeId);
    }, []);
    
    const calculateAverageWeeklyHoursForEmployee = useCallback((employeeId: string, newAssignment?: Omit<AssignedShift, 'id' | 'employeeName' | 'shiftPatternName' | keyof Syncable>, assignmentToExcludeId?: string): number => {
        const assignmentsForEmployee = assignedShiftsRef.current
            .filter(as => as.employeeId === employeeId && as.id !== assignmentToExcludeId);

        if (newAssignment) {
            assignmentsForEmployee.push({
                ...newAssignment,
                id: 'temp', lastModified: 0, syncStatus: 'synced', isDeleted: false
            });
        }
        
        if (assignmentsForEmployee.length === 0) return 0;

        let totalHours = 0;
        let totalDays = 0;

        // This is a simplified calculation. It takes the average of all assigned patterns.
        // A more complex logic would be needed for time-bound assignments within a specific range.
        for (const assignment of assignmentsForEmployee) {
            const pattern = shiftPatternsRef.current.find(p => p.id === assignment.shiftPatternId);
            if (pattern && pattern.cycleLengthDays > 0) {
                const totalHoursInCycle = pattern.dailySchedules.reduce((sum, day) => sum + (day.hours || 0), 0);
                const avgWeeklyHoursForPattern = (totalHoursInCycle / pattern.cycleLengthDays) * DAYS_IN_WEEK;
                totalHours += avgWeeklyHoursForPattern;
                totalDays += 1; // Count each assignment as one "unit" for averaging
            }
        }
        
        return totalDays > 0 ? (totalHours / totalDays) : 0;
    }, []);
    
    const isEmployeeScheduledOnDate = useCallback((employeeId: string, targetDate: Date): { scheduled: boolean, shiftPatternName?: string, startTime?: string, endTime?: string, patternColor?: string } => {
        const schedule = getEmployeeDailyScheduleInfo(employeeId, targetDate);
        if (schedule && schedule.isWorkDay) {
            return {
                scheduled: true,
                shiftPatternName: schedule.shiftPatternName,
                startTime: schedule.startTime,
                endTime: schedule.endTime,
                patternColor: schedule.patternColor
            };
        }
        return { scheduled: false };
    }, [getEmployeeDailyScheduleInfo]);
    
    const getScheduledEmployeesDetailsOnDate = useCallback((targetDate: Date): ScheduledEmployeeDetail[] => {
        const details: ScheduledEmployeeDetail[] = [];
        activeEmployees.forEach(emp => {
            const schedule = getEmployeeDailyScheduleInfo(emp.id, targetDate);
            if (schedule && schedule.isWorkDay) {
                details.push({
                    employeeId: emp.id,
                    employeeName: emp.name,
                    shiftPatternName: schedule.shiftPatternName || 'N/A',
                    startTime: schedule.startTime,
                    endTime: schedule.endTime,
                    patternColor: schedule.patternColor,
                });
            }
        });
        return details;
    }, [activeEmployees, getEmployeeDailyScheduleInfo]);
    
    const getEmployeesWithAssignedShifts = useCallback((): EmployeeWithShiftDetails[] => {
        const employeeMap = new Map<string, EmployeeWithShiftDetails>();
        activeEmployees.forEach(emp => {
            employeeMap.set(emp.id, { ...emp, assignedShiftsDetails: [] });
        });
        
        assignedShiftsRef.current.forEach(as => {
            const emp = employeeMap.get(as.employeeId);
            if (emp) {
                const pattern = shiftPatternsRef.current.find(p => p.id === as.shiftPatternId);
                emp.assignedShiftsDetails.push({ ...as, patternDetails: pattern });
            }
        });
        
        return Array.from(employeeMap.values()).filter(emp => emp.assignedShiftsDetails.length > 0);
    }, [activeEmployees]);
    
    const getEmployeeScheduleForMonth = useCallback((employeeId: string, year: number, month: number): MonthlyDayScheduleView[] => {
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        const scheduleViews: MonthlyDayScheduleView[] = [];
        const dayNames = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];

        for (let day = 1; day <= daysInMonth; day++) {
            const targetDate = new Date(year, month, day);
            const scheduleInfo = getEmployeeDailyScheduleInfo(employeeId, targetDate);
            
            const scheduleText = scheduleInfo?.isWorkDay 
                ? `${dayNames[targetDate.getDay()]} ${day} - ${scheduleInfo.scheduleText}` 
                : `${dayNames[targetDate.getDay()]} ${day} - Libre`;
            
            scheduleViews.push({
                dateIso: targetDate.toISOString().split('T')[0],
                dayOfWeek: dayNames[targetDate.getDay()],
                dayOfMonth: day,
                scheduleText: scheduleText,
                isWorkDay: scheduleInfo?.isWorkDay || false
            });
        }
        return scheduleViews;
    }, [getEmployeeDailyScheduleInfo]);

    return (
        <TheoreticalShiftContext.Provider value={{
            globalMaxWeeklyHours,
            areaList,
            meterConfigs,
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
            updateMeterConfigs,
        }}>
            {children}
        </TheoreticalShiftContext.Provider>
    );
};