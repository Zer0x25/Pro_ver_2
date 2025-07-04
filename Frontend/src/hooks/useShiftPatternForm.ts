import { useState, useEffect, useMemo, useCallback } from 'react';
import { TheoreticalShiftPattern, DayInCycleSchedule } from '../types';
import { useTheoreticalShifts } from './useTheoreticalShifts';
import { useAuth } from './useAuth';
import { useToasts } from './useToasts';

const PRESET_COLORS = [
  '#F44336', '#E91E63', '#9C27B0', '#673AB7', '#3F51B5', 
  '#2196F3', '#03A9F4', '#00BCD4', '#009688', '#4CAF50', 
  '#8BC34A', '#CDDC39', '#FFEB3B', '#FFC107', '#FF9800', 
  '#FF5722', '#795548', '#9E9E9E', '#607D8B'
];

const createInitialDailySchedules = (cycleLength: number): DayInCycleSchedule[] => {
  return Array.from({ length: cycleLength }, (_, i) => ({
    dayIndex: i,
    startTime: '',
    endTime: '',
    isOffDay: false,
    hasColacion: false,
    colacionMinutes: 0,
    hours: 0,
  }));
};

export const useShiftPatternForm = () => {
    const { 
        globalMaxWeeklyHours,
        shiftPatterns,
        addShiftPattern, 
        updateShiftPattern, 
        calculateHoursBetween 
    } = useTheoreticalShifts();
    const { currentUser } = useAuth();
    const { addToast } = useToasts();
    
    const actorUsername = useMemo(() => currentUser?.username || 'System', [currentUser]);

    const [editingPattern, setEditingPattern] = useState<TheoreticalShiftPattern | null>(null);
    const [patternName, setPatternName] = useState('');
    const [patternCycleLength, setPatternCycleLengthState] = useState(7);
    const [startDayOfWeek, setStartDayOfWeek] = useState(1); // 1 for Monday
    const [patternDailySchedules, setPatternDailySchedules] = useState<DayInCycleSchedule[]>(createInitialDailySchedules(7));
    const [patternColor, setPatternColor] = useState(PRESET_COLORS[0]);
    const [patternMaxHoursInput, setPatternMaxHoursInput] = useState<number>(globalMaxWeeklyHours);
    const [copiedDailySchedule, setCopiedDailySchedule] = useState<Omit<DayInCycleSchedule, 'dayIndex' | 'hours'> | null>(null);
    
    const getRandomColor = useCallback(() => {
        const usedColors = new Set(shiftPatterns.map(p => p.color?.toUpperCase()).filter(Boolean));
        const availableColors = PRESET_COLORS.filter(c => !usedColors.has(c.toUpperCase()));
        
        if (availableColors.length > 0) {
            return availableColors[Math.floor(Math.random() * availableColors.length)];
        } else if (shiftPatterns.length > 0) {
            return PRESET_COLORS[Math.floor(Math.random() * PRESET_COLORS.length)];
        } else {
            return PRESET_COLORS[0];
        }
    }, [shiftPatterns]);


    const handleSetPatternCycleLength = useCallback((value: number) => {
        let cycleValue = value;
        if (cycleValue > 99) {
            cycleValue = 99;
            addToast("El ciclo no puede exceder los 99 días.", "warning");
        }
        setPatternCycleLengthState(cycleValue);
    }, [addToast]);

    const clearForm = useCallback(() => {
        setEditingPattern(null);
        setPatternName('');
        handleSetPatternCycleLength(7);
        setPatternColor(getRandomColor());
        setPatternMaxHoursInput(globalMaxWeeklyHours);
        setPatternDailySchedules(createInitialDailySchedules(7));
        setStartDayOfWeek(1);
    }, [globalMaxWeeklyHours, handleSetPatternCycleLength, getRandomColor]);

    const startCopyOfPattern = useCallback((patternToCopy: TheoreticalShiftPattern) => {
        setEditingPattern(null); // Ensure we're in "create" mode, not "edit"
        setPatternName(`${patternToCopy.name} - copia`);
        handleSetPatternCycleLength(patternToCopy.cycleLengthDays);
        setStartDayOfWeek(patternToCopy.startDayOfWeek || 1);
        setPatternColor(patternToCopy.color || PRESET_COLORS[0]);
        setPatternMaxHoursInput(patternToCopy.maxHoursPattern || globalMaxWeeklyHours);
        
        const copiedSchedules = patternToCopy.dailySchedules.map(s => ({
            dayIndex: s.dayIndex,
            startTime: s.startTime || '',
            endTime: s.endTime || '',
            isOffDay: s.isOffDay || false,
            hasColacion: s.hasColacion || false,
            colacionMinutes: s.colacionMinutes || 0,
            hours: (s.isOffDay || false) ? 0 : calculateHoursBetween(s.startTime, s.endTime, (s.hasColacion || false) ? (s.colacionMinutes || 0) : 0)
        }));
        setPatternDailySchedules(copiedSchedules);
        
        addToast(`Copiando patrón "${patternToCopy.name}". Modifique y guarde.`, 'info');
    }, [handleSetPatternCycleLength, globalMaxWeeklyHours, calculateHoursBetween, addToast]);

    useEffect(() => {
        if (editingPattern) {
            setPatternName(editingPattern.name);
            handleSetPatternCycleLength(editingPattern.cycleLengthDays);
            setStartDayOfWeek(editingPattern.startDayOfWeek || 1);
            setPatternColor(editingPattern.color || PRESET_COLORS[0]);
            setPatternMaxHoursInput(editingPattern.maxHoursPattern || globalMaxWeeklyHours);
            setPatternDailySchedules(editingPattern.dailySchedules.map(s => ({
                dayIndex: s.dayIndex,
                startTime: s.startTime || '',
                endTime: s.endTime || '',
                isOffDay: s.isOffDay || false,
                hasColacion: s.hasColacion || false,
                colacionMinutes: s.colacionMinutes || 0,
                hours: (s.isOffDay || false) ? 0 : calculateHoursBetween(s.startTime, s.endTime, (s.hasColacion || false) ? (s.colacionMinutes || 0) : 0)
            })));
        } else {
            // clearForm(); // Don't clear if a copy operation is in progress
        }
    }, [editingPattern, calculateHoursBetween, globalMaxWeeklyHours, handleSetPatternCycleLength]);

    useEffect(() => {
        const newLength = Math.max(1, patternCycleLength);
        setPatternDailySchedules(prevSchedules => {
            if (prevSchedules.length === newLength && prevSchedules.every((s, i) => s.dayIndex === i)) {
                return prevSchedules;
            }
            const newArr: DayInCycleSchedule[] = [];
            for (let i = 0; i < newLength; i++) {
                const existingSchedule = prevSchedules.find(s => s.dayIndex === i);
                if (existingSchedule) {
                    newArr.push({ ...existingSchedule, dayIndex: i });
                } else {
                    newArr.push({
                        dayIndex: i, startTime: '', endTime: '', isOffDay: false,
                        hasColacion: false, colacionMinutes: 0, hours: 0
                    });
                }
            }
            return newArr;
        });
    }, [patternCycleLength]);

    const handleDailyScheduleChange = useCallback((index: number, field: keyof DayInCycleSchedule, value: string | boolean | number) => {
        setPatternDailySchedules(prev =>
            prev.map((schedule, i) => {
                if (i === index) {
                    const updatedSchedule = { ...schedule, [field]: value };
                    
                    if (field === 'hasColacion') {
                        if (value === true) {
                            updatedSchedule.colacionMinutes = 30; // Default to 30 when checked
                        } else {
                            updatedSchedule.colacionMinutes = 0; // Reset to 0 when unchecked
                        }
                    }

                    if (field === 'isOffDay' && value === true) {
                        updatedSchedule.startTime = '';
                        updatedSchedule.endTime = '';
                        updatedSchedule.hasColacion = false;
                        updatedSchedule.colacionMinutes = 0;
                    }

                    updatedSchedule.hours = updatedSchedule.isOffDay
                        ? 0
                        : calculateHoursBetween(
                            updatedSchedule.startTime,
                            updatedSchedule.endTime,
                            updatedSchedule.hasColacion ? updatedSchedule.colacionMinutes : 0
                        );
                    return updatedSchedule;
                }
                return schedule;
            })
        );
    }, [calculateHoursBetween]);

    const handleCopyDailySchedule = useCallback((dayIndex: number) => {
        const scheduleToCopy = patternDailySchedules.find(s => s.dayIndex === dayIndex);
        if (scheduleToCopy) {
            const { dayIndex: _di, hours: _h, ...rest } = scheduleToCopy;
            setCopiedDailySchedule(rest);
            addToast(`Horario del Día ${dayIndex + 1} copiado.`, 'success');
        }
    }, [patternDailySchedules, addToast]);

    const handlePasteDailySchedule = useCallback((targetDayIndex: number) => {
        if (!copiedDailySchedule) {
            addToast("No hay horario copiado para pegar.", 'info');
            return;
        }
        setPatternDailySchedules(prev =>
            prev.map((schedule, i) => {
                if (i === targetDayIndex) {
                    const newScheduleData = { ...schedule, ...copiedDailySchedule };
                    if (newScheduleData.isOffDay) {
                        newScheduleData.startTime = '';
                        newScheduleData.endTime = '';
                        newScheduleData.hasColacion = false;
                        newScheduleData.colacionMinutes = 0;
                    }
                    newScheduleData.hours = newScheduleData.isOffDay
                        ? 0
                        : calculateHoursBetween(
                            newScheduleData.startTime,
                            newScheduleData.endTime,
                            newScheduleData.hasColacion ? newScheduleData.colacionMinutes : 0
                        );
                    return newScheduleData;
                }
                return schedule;
            })
        );
        addToast(`Horario pegado en Día ${targetDayIndex + 1}.`, 'success');
    }, [copiedDailySchedule, addToast, calculateHoursBetween]);

    const handleSavePattern = async (): Promise<boolean> => {
        if (!patternName.trim() || patternCycleLength <= 0) {
            addToast("Nombre del patrón y duración del ciclo (mayor a 0) son requeridos.", "warning");
            return false;
        }
        if (patternMaxHoursInput <= 0) {
            addToast("Max Hrs Semanales del Patrón debe ser un número positivo.", "warning");
            return false;
        }
        if (patternMaxHoursInput > globalMaxWeeklyHours) {
            addToast(`Las horas del patrón (${patternMaxHoursInput}) no pueden superar el máximo legal de ${globalMaxWeeklyHours} horas.`, "error", 6000);
            return false;
        }

        const trimmedNewName = patternName.trim().toLowerCase();
        const isDuplicate = shiftPatterns.some(
            p => p.name.trim().toLowerCase() === trimmedNewName && p.id !== editingPattern?.id
        );

        if (isDuplicate) {
            addToast(`El nombre de patrón "${patternName.trim()}" ya existe.`, "error");
            return false;
        }

        const dataForContext = patternDailySchedules.map(s => {
            const { hours, ...rest } = s;
            return rest;
        });
        
        for (const schedule of dataForContext) {
            if (!schedule.isOffDay && (!schedule.startTime || !schedule.endTime)) {
                addToast(`Día ${schedule.dayIndex + 1}: Hora de inicio y fin son requeridas si no es día libre.`, "warning");
                return false;
            }
            if (schedule.hasColacion && schedule.colacionMinutes <= 0) {
                addToast(`Día ${schedule.dayIndex + 1}: Minutos de colación deben ser mayor a 0 si 'Incluir Colación' está marcado.`, "warning");
                return false;
            }
            if (!schedule.isOffDay && schedule.startTime && schedule.endTime) {
                const dailyHoursNet = calculateHoursBetween(schedule.startTime, schedule.endTime, schedule.hasColacion ? schedule.colacionMinutes : 0);
                if (dailyHoursNet < 0) {
                    addToast(`En el Día ${schedule.dayIndex + 1}, la hora de fin debe ser posterior a la hora de inicio (considerando colación). Un turno de 24hrs no es posible (00:00 a 00:00).`, "error");
                    return false;
                }
                if (schedule.hasColacion) {
                    const grossShiftDuration = calculateHoursBetween(schedule.startTime, schedule.endTime, 0);
                    if (schedule.colacionMinutes / 60 > grossShiftDuration) {
                        addToast(`Día ${schedule.dayIndex + 1}: Los minutos de colación no pueden exceder la duración total del turno.`, "error");
                        return false;
                    }
                }
            }
        }
        
        const patternPayload = {
            name: patternName,
            cycleLengthDays: patternCycleLength,
            dailySchedules: dataForContext,
            color: patternColor,
            maxHoursPattern: patternMaxHoursInput,
            startDayOfWeek: startDayOfWeek,
        };

        let success = false;
        if (editingPattern) {
            success = await updateShiftPattern({ ...patternPayload, id: editingPattern.id }, actorUsername);
        } else {
            const newPattern = await addShiftPattern(patternPayload, actorUsername);
            success = !!newPattern;
        }
        if (success) {
            clearForm();
        }
        return success;
    };

    const calculatedPatternWeeklyHours = useMemo(() => {
        if (patternCycleLength <= 0) return 0;
        let totalHoursInCycle = 0;
        patternDailySchedules.forEach(ds => {
            if (!ds.isOffDay && ds.hours) {
                totalHoursInCycle += ds.hours;
            }
        });
        return parseFloat(((totalHoursInCycle / patternCycleLength) * 7).toFixed(2));
    }, [patternDailySchedules, patternCycleLength]);

    return {
        editingPattern,
        setEditingPattern,
        patternName,
        setPatternName,
        patternCycleLength,
        setPatternCycleLength: handleSetPatternCycleLength,
        startDayOfWeek,
        setStartDayOfWeek,
        patternDailySchedules,
        handleDailyScheduleChange,
        patternColor,
        setPatternColor,
        patternMaxHoursInput,
        setPatternMaxHoursInput,
        copiedDailySchedule,
        handleCopyDailySchedule,
        handlePasteDailySchedule,
        startCopyOfPattern,
        handleSavePattern,
        clearForm,
        calculatedPatternWeeklyHours
    };
};