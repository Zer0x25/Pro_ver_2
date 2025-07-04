import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { useEmployees } from '../../contexts/EmployeeContext';
import { useTheoreticalShifts } from '../../hooks/useTheoreticalShifts';
import { useTimeRecords } from '../../hooks/useTimeRecords';
import { DailyTimeRecord, ShiftReport, EmployeeDailyScheduleInfo, Employee, LogbookEntryItem } from '../../types';
import { idbGetAll, idbPut, getCounterValue, setCounterValue, STORES, COUNTER_IDS } from '../../utils/indexedDB';
import { useLogs } from '../../hooks/useLogs';
import { useToasts } from '../../hooks/useToasts';
import { ROUTES, STORAGE_KEYS } from '../../constants';
import { formatDisplayTime, formatDateToDateTimeLocal, formatTime } from '../../utils/formatters';
import QuickNotesModal from '../ui/QuickNotesModal';
import MetersModal from '../ui/MetersModal';
import { useUsers } from '../../hooks/useUsers';
import ShiftReportModal from '../ui/ShiftReportModal';
import { StatusAndActionsPanel, AlertsAndTeamStatusPanel } from '../dashboard/DashboardPanels';
import { useQuickNotes } from '../../hooks/useQuickNotes';
import ConfirmationModal from '../ui/ConfirmationModal';


export interface UpcomingEmployeeStatus {
  employee: Employee;
  shiftStartTime: Date;
  status: 'ontime' | 'late_warn' | 'late_alert' | 'absent';
  statusText: string;
  latenessMinutes: number;
}

export interface MissingClockOutStatus {
  employee: Employee;
  shiftEndTime: string; // HH:mm format
  timeDifferenceMinutes: number; // Positive if late, negative if upcoming
  status: 'upcoming' | 'late';
  recordId: string;
  recordDate: string;
}


const DashboardPage: React.FC = () => {
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const { employees, activeEmployees, getEmployeeById, isLoadingEmployees } = useEmployees();
  const { getEmployeeDailyScheduleInfo, isLoadingShifts } = useTheoreticalShifts();
  const { addLog } = useLogs();
  const { addToast } = useToasts();
  const { dailyRecords, isLoadingRecords, addOrUpdateRecord } = useTimeRecords();
  const { users } = useUsers();
  const { notes, isLoadingNotes } = useQuickNotes();

  const [shiftReports, setShiftReports] = useState<ShiftReport[]>([]);
  const [upcomingEmployees, setUpcomingEmployees] = useState<UpcomingEmployeeStatus[]>([]);
  const [missingClockOuts, setMissingClockOuts] = useState<MissingClockOutStatus[]>([]);
  
  const [isQuickNotesModalOpen, setIsQuickNotesModalOpen] = useState(false);
  const [hasUnreadNotes, setHasUnreadNotes] = useState(false);
  const [isMetersModalOpen, setIsMetersModalOpen] = useState(false);
  const [showReportDetailsModal, setShowReportDetailsModal] = useState<ShiftReport | null>(null);
  
  // State for clock-in/out confirmations
  const [employeeToClockIn, setEmployeeToClockIn] = useState<UpcomingEmployeeStatus | null>(null);
  const [employeeToClockOut, setEmployeeToClockOut] = useState<MissingClockOutStatus | null>(null);
  const [employeeToConfirmClockOut, setEmployeeToConfirmClockOut] = useState<Employee | null>(null);
  const [showResponsibleUserClockOutConfirmation, setShowResponsibleUserClockOutConfirmation] = useState(false);


  const isLoadingData = isLoadingEmployees || isLoadingShifts || isLoadingRecords || isLoadingNotes;

  useEffect(() => {
    if (isLoadingData) return;

    const lastViewedTimestamp = parseInt(localStorage.getItem(STORAGE_KEYS.LAST_QUICK_NOTES_VIEW_TIMESTAMP) || '0', 10);
    
    if (notes.length > 0) {
        const latestNoteTimestamp = Math.max(...notes.map(n => n.createdAt));
        if (latestNoteTimestamp > lastViewedTimestamp) {
            setHasUnreadNotes(true);
        } else {
            setHasUnreadNotes(false);
        }
    } else {
        setHasUnreadNotes(false);
    }
  }, [notes, isLoadingData]);

  const handleOpenQuickNotes = () => {
    localStorage.setItem(STORAGE_KEYS.LAST_QUICK_NOTES_VIEW_TIMESTAMP, String(Date.now()));
    setIsQuickNotesModalOpen(true);
    setHasUnreadNotes(false);
  };

  const handleUpcomingEmployeeDoubleClick = (employeeStatus: UpcomingEmployeeStatus) => {
    // Prevent clock-in if already has an open record, just in case state is stale
    const hasOpenRecord = dailyRecords.some(r =>
        r.employeeId === employeeStatus.employee.id &&
        r.entrada && !r.salida && r.entrada !== "SIN REGISTRO"
    );

    if (hasOpenRecord) {
        addToast(`${employeeStatus.employee.name} ya tiene una entrada registrada.`, 'info');
        return;
    }
    setEmployeeToClockIn(employeeStatus);
  };

  const handleConfirmClockIn = async () => {
    if (!employeeToClockIn || !currentUser) return;
    
    const { employee } = employeeToClockIn;
    const now = new Date();
    const THREE_MINUTES_IN_MS = 3 * 60 * 1000;

    // 3-minute check
    const employeeSpecificRecords = dailyRecords.filter(r => r.employeeId === employee.id);
    if (employeeSpecificRecords.length > 0) {
        const latestRecordForEmployee = employeeSpecificRecords[0]; // Records are sorted descending by time
        const latestTimestamp = Math.max(latestRecordForEmployee.entradaTimestamp || 0, latestRecordForEmployee.salidaTimestamp || 0);
        if (latestTimestamp > 0) {
            const timeDifference = now.getTime() - latestTimestamp;
            if (timeDifference < THREE_MINUTES_IN_MS) {
                addToast(`No puede ingresar un nuevo registro para ${employee.name} hasta que pasen 3 minutos desde su última marcación.`, 'warning', 7000);
                setEmployeeToClockIn(null);
                return;
            }
        }
    }

    const newRecord: DailyTimeRecord = {
      id: crypto.randomUUID(),
      employeeId: employee.id,
      employeeName: employee.name,
      employeePosition: employee.position,
      employeeArea: employee.area,
      date: now.toISOString().split('T')[0],
      entrada: formatDateToDateTimeLocal(now),
      entradaTimestamp: now.getTime(),
      lastModified: now.getTime(),
      syncStatus: 'pending',
      isDeleted: false,
    };

    const success = await addOrUpdateRecord(newRecord);
    if (success) {
      addToast(`Entrada registrada para ${employee.name}.`, 'success');
      await addLog(currentUser.username, 'Clock In Success from Dashboard', {
          employeeId: employee.id,
          employeeName: employee.name,
          recordId: newRecord.id,
      });
    } else {
      // Toast is handled by the hook
       await addLog(currentUser.username, 'Clock In DB Error from Dashboard', {
          employeeId: employee.id,
          employeeName: employee.name,
          error: "Failed to save record via useTimeRecords hook"
      });
    }
    
    setEmployeeToClockIn(null);
  };
  
  const handleMissingClockOutDoubleClick = (item: MissingClockOutStatus) => {
    if (item.status === 'upcoming') {
        addToast(`${item.employee.name} aún no ha terminado su turno.`, 'info');
        return;
    }
    setEmployeeToClockOut(item);
  };

  const handleConfirmClockOut = async () => {
    if (!employeeToClockOut || !currentUser) return;

    const { employee, recordId } = employeeToClockOut;

    // Check for responsible user case first
    const userForEmployee = users.find(u => u.employeeId === employee.id);
    if (userForEmployee) {
        const openShiftForUser = shiftReports.find(s => s.status === 'open' && s.responsibleUser === userForEmployee.username);
        if (openShiftForUser) {
            setEmployeeToConfirmClockOut(employee);
            setShowResponsibleUserClockOutConfirmation(true);
            setEmployeeToClockOut(null);
            return;
        }
    }

    // Standard clock-out
    const recordToUpdate = dailyRecords.find(r => r.id === recordId);
    if (!recordToUpdate) {
        addToast("No se encontró el registro de entrada para este empleado.", "error");
        setEmployeeToClockOut(null);
        return;
    }
    const now = new Date();
    const updatedRecord: DailyTimeRecord = {
        ...recordToUpdate,
        salida: formatDateToDateTimeLocal(now),
        salidaTimestamp: now.getTime(),
        lastModified: now.getTime(),
        syncStatus: 'pending',
    };
    const success = await addOrUpdateRecord(updatedRecord);
    if (success) {
        addToast(`Salida registrada para ${employee.name}.`, 'success');
        await addLog(currentUser.username, 'Clock Out Success from Dashboard', {
            employeeId: employee.id,
            employeeName: employee.name,
            recordId: updatedRecord.id,
        });
        
        // --- Early Departure Check ---
        const activeShift = shiftReports.find(s => s.status === 'open');
        if (activeShift && recordToUpdate.entradaTimestamp) {
            const clockInDate = new Date(recordToUpdate.entradaTimestamp);
            const scheduleInfo = getEmployeeDailyScheduleInfo(employee.id, clockInDate);

            if (scheduleInfo?.isWorkDay && scheduleInfo.endTime) {
                const [endHour, endMinute] = scheduleInfo.endTime.split(':').map(Number);
                const scheduledEndTime = new Date(clockInDate.getFullYear(), clockInDate.getMonth(), clockInDate.getDate(), endHour, endMinute);
                if (scheduledEndTime < clockInDate) {
                    scheduledEndTime.setDate(scheduledEndTime.getDate() + 1);
                }
                const timeDifferenceMs = scheduledEndTime.getTime() - now.getTime();
                const FIFTEEN_MINUTES_IN_MS = 15 * 60 * 1000;
                
                if (timeDifferenceMs > FIFTEEN_MINUTES_IN_MS) {
                    const noveltyAnnotation = `Empleado ${employee.name} se retira antes de su horario de salida (registro automatico)`;
                    const newNovelty: LogbookEntryItem = {
                        id: crypto.randomUUID(),
                        time: formatTime(now),
                        annotation: noveltyAnnotation,
                        timestamp: now.getTime(),
                    };
                    const updatedShift: ShiftReport = {
                        ...activeShift,
                        logEntries: [...activeShift.logEntries, newNovelty].sort((a,b) => a.timestamp - b.timestamp),
                        lastModified: Date.now(),
                        syncStatus: 'pending'
                    };
                    await idbPut<ShiftReport>(STORES.SHIFT_REPORTS, updatedShift);
                    setShiftReports(prev => prev.map(s => s.id === updatedShift.id ? updatedShift : s));
                    addToast("Novedad automática registrada por retiro anticipado.", 'info');
                }
            }
        }
        // --- End Early Departure Check ---
    }
    setEmployeeToClockOut(null);
  };

  const handleConfirmResponsibleUserClockOut = async () => {
    if (!employeeToConfirmClockOut || !currentUser) return;
    const latestOpenEntry = dailyRecords.find(r => r.employeeId === employeeToConfirmClockOut.id && r.entrada && !r.salida && r.entrada !== "SIN REGISTRO");
    if (!latestOpenEntry) {
        addToast(`No se encontró una entrada abierta para ${employeeToConfirmClockOut.name}.`, 'error');
        setShowResponsibleUserClockOutConfirmation(false);
        setEmployeeToConfirmClockOut(null);
        return;
    }
    const now = new Date();
    const recordToSave: DailyTimeRecord = { ...latestOpenEntry, salida: formatDateToDateTimeLocal(now), salidaTimestamp: now.getTime(), lastModified: Date.now(), syncStatus: 'pending' };
    const success = await addOrUpdateRecord(recordToSave);
    if (success) {
        addToast('Salida registrada. Iniciando cierre automático de turno...', 'success');
        await addLog(currentUser.username, 'Clock Out Success (Shift Responsible)', { employeeId: employeeToConfirmClockOut.id, employeeName: employeeToConfirmClockOut.name, recordId: recordToSave.id });

        // --- Early Departure Check ---
        const activeShift = shiftReports.find(s => s.status === 'open');
        if (activeShift && latestOpenEntry.entradaTimestamp) {
            const clockInDate = new Date(latestOpenEntry.entradaTimestamp);
            const scheduleInfo = getEmployeeDailyScheduleInfo(employeeToConfirmClockOut.id, clockInDate);

            if (scheduleInfo?.isWorkDay && scheduleInfo.endTime) {
                const [endHour, endMinute] = scheduleInfo.endTime.split(':').map(Number);
                const scheduledEndTime = new Date(clockInDate.getFullYear(), clockInDate.getMonth(), clockInDate.getDate(), endHour, endMinute);
                if (scheduledEndTime < clockInDate) {
                    scheduledEndTime.setDate(scheduledEndTime.getDate() + 1);
                }
                const timeDifferenceMs = scheduledEndTime.getTime() - now.getTime();
                const FIFTEEN_MINUTES_IN_MS = 15 * 60 * 1000;
                
                if (timeDifferenceMs > FIFTEEN_MINUTES_IN_MS) {
                    const noveltyAnnotation = `Empleado ${employeeToConfirmClockOut.name} se retira antes de su horario de salida (registro automatico)`;
                    const newNovelty: LogbookEntryItem = {
                        id: crypto.randomUUID(),
                        time: formatTime(now),
                        annotation: noveltyAnnotation,
                        timestamp: now.getTime(),
                    };
                    const updatedShift: ShiftReport = {
                        ...activeShift,
                        logEntries: [...activeShift.logEntries, newNovelty].sort((a,b) => a.timestamp - b.timestamp),
                        lastModified: Date.now(),
                        syncStatus: 'pending'
                    };
                    await idbPut<ShiftReport>(STORES.SHIFT_REPORTS, updatedShift);
                    setShiftReports(prev => prev.map(s => s.id === updatedShift.id ? updatedShift : s));
                    addToast("Novedad automática registrada por retiro anticipado.", 'info');
                }
            }
        }
        // --- End Early Departure Check ---

        sessionStorage.setItem(STORAGE_KEYS.TRIGGER_AUTO_CLOSE_SHIFT, 'true');
        navigate(ROUTES.LOGBOOK);
    } else {
        await addLog(currentUser.username, 'Clock Out DB Error (Shift Responsible)', { recordId: latestOpenEntry.id, error: "Failed to save record" });
    }
    setShowResponsibleUserClockOutConfirmation(false);
    setEmployeeToConfirmClockOut(null);
  };

  useEffect(() => {
    const fetchReports = async () => {
      try {
        const reports = await idbGetAll<ShiftReport>(STORES.SHIFT_REPORTS);
        setShiftReports(reports.sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime()));
      } catch (error) {
        console.error("Error fetching dashboard reports:", error);
      }
    };

    if (!isLoadingEmployees && !isLoadingShifts) {
      fetchReports();
    }
  }, [isLoadingEmployees, isLoadingShifts]);

  // This single effect handles all login automations for the 'Reloj Control' user.
  useEffect(() => {
    const formatDateYYYYMMDD = (date: Date): string => {
        const year = date.getFullYear();
        const month = (date.getMonth() + 1).toString().padStart(2, '0');
        const day = date.getDate().toString().padStart(2, '0');
        return `${year}-${month}-${day}`;
    };

    const runLoginAutomations = async () => {
        const checkDone = sessionStorage.getItem(STORAGE_KEYS.AUTO_LOGIN_ACTIONS_DONE);
        if (checkDone || !currentUser?.employeeId) return;
        sessionStorage.setItem(STORAGE_KEYS.AUTO_LOGIN_ACTIONS_DONE, 'true');

        const employee = getEmployeeById(currentUser.employeeId);
        if (!employee || employee.position.toLowerCase() !== 'reloj control') return;
        
        const now = new Date();
        const scheduleInfo = getEmployeeDailyScheduleInfo(employee.id, now);
        
        if (!scheduleInfo?.isWorkDay || !scheduleInfo.startTime) return;
        
        const [startHour, startMinute] = scheduleInfo.startTime.split(':').map(Number);
        const shiftStartTime = new Date(now.getFullYear(), now.getMonth(), now.getDate(), startHour, startMinute);
        
        // --- Automation 1: Auto Clock-In ---
        const hasOpenRecord = dailyRecords.some(r =>
            r.employeeId === currentUser.employeeId &&
            r.entrada && !r.salida && r.entrada !== "SIN REGISTRO"
        );
        
        if (!hasOpenRecord && now >= shiftStartTime) {
            const newRecord: DailyTimeRecord = {
                id: crypto.randomUUID(),
                employeeId: employee.id, employeeName: employee.name, employeePosition: employee.position, employeeArea: employee.area,
                date: now.toISOString().split('T')[0],
                entrada: formatDateToDateTimeLocal(now), entradaTimestamp: now.getTime(),
                lastModified: now.getTime(), syncStatus: 'pending', isDeleted: false,
            };
            const success = await addOrUpdateRecord(newRecord);
            if (success) {
                addToast('Se ha registrado tu entrada automáticamente.', 'success');
                await addLog(currentUser.username, 'Auto Clock-In on Login', { employeeId: employee.id });
            }
        }

        // --- Automation 2: Auto Start Shift (with auto-close if necessary) ---
        if (scheduleInfo.endTime) {
            const [endHour, endMinute] = scheduleInfo.endTime.split(':').map(Number);
            const scheduleEndDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), endHour, endMinute, 0);
            if (scheduleEndDate < shiftStartTime) scheduleEndDate.setDate(scheduleEndDate.getDate() + 1);

            const oneHourBeforeStart = new Date(shiftStartTime.getTime() - 60 * 60 * 1000);

            // Is it time for the "Reloj Control" user's shift to start?
            if (now >= oneHourBeforeStart && now <= scheduleEndDate) {
                const openShiftToClose = shiftReports.find(s => s.status === 'open');
                
                // Prevent re-creating a shift if the currently open one was just started by this same user
                const isShiftJustStartedByMe = openShiftToClose?.responsibleUser === currentUser.username && (now.getTime() - new Date(openShiftToClose.startTime).getTime() < 60000);
                if (isShiftJustStartedByMe) return;

                try {
                    const actor = currentUser.username;
                    const currentFolioCounter = await getCounterValue(COUNTER_IDS.LOGBOOK_FOLIO, 1);
                    const newFolio = String(currentFolioCounter).padStart(3, '0');
                    let closedShift: ShiftReport | null = null;
                    
                    if (openShiftToClose) {
                        const closingAnnotation = `Cierre de forma automarica, por inicio de Nuevo Folio N°${newFolio}`;
                        const closingEntry: LogbookEntryItem = {
                            id: crypto.randomUUID(),
                            time: new Date().toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit', hour12: false }),
                            annotation: closingAnnotation,
                            timestamp: Date.now() - 1, // Ensure it's before the new shift starts
                        };

                        closedShift = {
                            ...openShiftToClose,
                            status: 'closed',
                            endTime: new Date(Date.now() - 1).toISOString(),
                            logEntries: [...openShiftToClose.logEntries, closingEntry].sort((a,b) => a.timestamp - b.timestamp),
                            lastModified: Date.now() - 1,
                            syncStatus: 'pending',
                        };
                        
                        await idbPut<ShiftReport>(STORES.SHIFT_REPORTS, closedShift);
                        addToast(`Turno anterior (${openShiftToClose.folio}) cerrado automáticamente.`, 'info');
                        await addLog(actor, 'Shift Auto-Closed', { folio: openShiftToClose.folio, reason: `New shift ${newFolio} started` });
                    }

                    const shiftNameToStart = (now.getHours() >= 8 && now.getHours() < 20) ? 'DÍA' : 'NOCHE';
                    const startingEntry: LogbookEntryItem = {
                        id: now.getTime().toString(),
                        time: now.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit', hour12: false }),
                        annotation: "Inicio de Turno, con Novedades Mencionadas",
                        timestamp: now.getTime(),
                    };
                    const newShift: ShiftReport = {
                        id: now.toISOString() + '-' + Math.random().toString(36).substr(2, 9),
                        folio: newFolio, date: formatDateYYYYMMDD(now), shiftName: shiftNameToStart,
                        responsibleUser: actor, startTime: now.toISOString(), status: 'open',
                        logEntries: [startingEntry], supplierEntries: [],
                        lastModified: now.getTime(), syncStatus: 'pending', isDeleted: false,
                    };
                    
                    await idbPut<ShiftReport>(STORES.SHIFT_REPORTS, newShift);
                    await setCounterValue(COUNTER_IDS.LOGBOOK_FOLIO, currentFolioCounter + 1);

                    setShiftReports(prev => {
                        let reports = [...prev];
                        if (openShiftToClose && closedShift) {
                            reports = reports.filter(s => s.id !== openShiftToClose.id);
                            reports.push(closedShift);
                        }
                        reports.push(newShift);
                        return reports.sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime());
                    });

                    addToast(`Turno ${newFolio} (${shiftNameToStart}) iniciado automáticamente.`, 'success');
                    await addLog(actor, 'Shift Auto-Started on Login', { folio: newShift.folio });

                } catch (error) {
                    console.error("Error during auto-start shift:", error);
                    await addLog(currentUser.username, 'Shift Auto-Start Failed on Login', { error: String(error) });
                    addToast("Error al iniciar turno automáticamente.", "error");
                    sessionStorage.removeItem(STORAGE_KEYS.AUTO_LOGIN_ACTIONS_DONE);
                }
            }
        }
    };
    
    if (!isLoadingData) {
        runLoginAutomations();
    }
  }, [isLoadingData, currentUser, getEmployeeById, getEmployeeDailyScheduleInfo, dailyRecords, addOrUpdateRecord, addToast, addLog, shiftReports]);
  
  const activeShiftReport = useMemo(() => {
    return shiftReports.find(r => r.status === 'open') || null;
  }, [shiftReports]);

  // useEffect for "Próximos a Entrar" card
  useEffect(() => {
    const updateUpcomingEmployees = async () => {
      if (isLoadingData || !Array.isArray(activeEmployees)) return;

      const now = new Date();
      
      const scheduledToday = activeEmployees
        .map(emp => {
          const schedule = getEmployeeDailyScheduleInfo(emp.id, now);
          if (schedule && schedule.isWorkDay && schedule.startTime) {
            const [hour, minute] = schedule.startTime.split(':').map(Number);
            const shiftStartTime = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hour, minute);
            return { employee: emp, shiftStartTime };
          }
          return null;
        })
        .filter((item): item is { employee: Employee; shiftStartTime: Date } => item !== null);

      const currentlyClockedInIds = new Set<string>();
      activeEmployees.forEach(emp => {
        const latestRecordForEmp = dailyRecords.find(r => r.employeeId === emp.id);
        if (latestRecordForEmp && latestRecordForEmp.entrada && !latestRecordForEmp.salida && latestRecordForEmp.entrada !== "SIN REGISTRO") {
          currentlyClockedInIds.add(emp.id);
        }
      });

      const notYetArrived = scheduledToday.filter(item => !currentlyClockedInIds.has(item.employee.id));
      
      const upcoming = notYetArrived
        .filter(item => {
          const timeDiff = item.shiftStartTime.getTime() - now.getTime();
          return timeDiff < (4 * 60 * 60 * 1000) && timeDiff > -(2 * 60 * 60 * 1000); // Show within 4h before, 2h after
        })
        .sort((a, b) => a.shiftStartTime.getTime() - b.shiftStartTime.getTime())
        .slice(0, 5);

      const upcomingWithStatus: UpcomingEmployeeStatus[] = upcoming.map(item => {
        const diffMs = now.getTime() - item.shiftStartTime.getTime();
        let status: 'ontime' | 'late_warn' | 'late_alert' | 'absent' = 'ontime';
        let statusText = 'A tiempo';
        let latenessMinutes = 0;

        if (diffMs > 0) {
          latenessMinutes = Math.floor(diffMs / 60000);
          statusText = `${latenessMinutes} min atraso`;
          
          if (latenessMinutes > 60) {
            status = 'absent'; // Red
            statusText = `Ausente (+60 min)`;
          } else if (latenessMinutes > 15) {
            status = 'late_alert'; // Orange
          } else { // 1 to 15 minutes
            status = 'late_warn'; // Yellow
          }
        }
        return { ...item, status, statusText, latenessMinutes };
      });

      setUpcomingEmployees(upcomingWithStatus);

      // --- Handle automatic log entries ---
      if (activeShiftReport && upcomingWithStatus.some(e => e.latenessMinutes > 15)) {
        let logEntriesToAdd: LogbookEntryItem[] = [];
        let shiftNeedsUpdate = false;
        
        for (const emp of upcomingWithStatus) {
            const employeeId = emp.employee.id;
            const todayStrForLogKey = new Date().toISOString().split('T')[0];
            
            if (emp.latenessMinutes > 60) { // Ausencia
                const absenceLogKey = `absence-log-${employeeId}-${todayStrForLogKey}`;
                if (!sessionStorage.getItem(absenceLogKey)) {
                    logEntriesToAdd.push({
                        id: crypto.randomUUID(),
                        time: new Date().toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit', hour12: false }),
                        annotation: `Novedad: Empleado ${emp.employee.name} se marca como ausente (atraso > 60 min).`,
                        timestamp: Date.now() + 1, // Ensure unique timestamp
                    });
                    sessionStorage.setItem(absenceLogKey, 'true');
                    sessionStorage.setItem(`late-log-${employeeId}-${todayStrForLogKey}`, 'true'); 
                    shiftNeedsUpdate = true;
                }
            } else if (emp.latenessMinutes > 15) { // Atraso (16-60)
                const lateLogKey = `late-log-${employeeId}-${todayStrForLogKey}`;
                if (!sessionStorage.getItem(lateLogKey)) {
                    logEntriesToAdd.push({
                        id: crypto.randomUUID(),
                        time: new Date().toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit', hour12: false }),
                        annotation: `Novedad: Empleado ${emp.employee.name} presenta atraso.`,
                        timestamp: Date.now(),
                    });
                    sessionStorage.setItem(lateLogKey, 'true');
                    shiftNeedsUpdate = true;
                }
            }
        }

        if (shiftNeedsUpdate) {
            const uniqueNewLogs = logEntriesToAdd.filter(newLog => 
                !activeShiftReport.logEntries.some(existingLog => existingLog.annotation === newLog.annotation && existingLog.time === newLog.time)
            );
            
            if (uniqueNewLogs.length > 0) {
                const updatedShift = { 
                    ...activeShiftReport, 
                    logEntries: [...activeShiftReport.logEntries, ...uniqueNewLogs].sort((a,b) => a.timestamp - b.timestamp) 
                };
                await idbPut<ShiftReport>(STORES.SHIFT_REPORTS, updatedShift);
                setShiftReports(prev => prev.map(s => s.id === updatedShift.id ? updatedShift : s));
                uniqueNewLogs.forEach(log => addToast(log.annotation, 'info'));
            }
        }
      }
    };

    const intervalId = setInterval(updateUpcomingEmployees, 60000);
    updateUpcomingEmployees();

    return () => clearInterval(intervalId);
  }, [isLoadingData, activeEmployees, dailyRecords, activeShiftReport, getEmployeeDailyScheduleInfo, addToast]);


  // useEffect for "Salidas Faltantes" card
  useEffect(() => {
    const updateMissingClockOuts = () => {
        if (isLoadingData || !Array.isArray(activeEmployees)) return;
        const now = new Date();
        const employeesToTrack: MissingClockOutStatus[] = [];
        const clockedInRecords = dailyRecords.filter(r => r.entrada && !r.salida && r.entrada !== "SIN REGISTRO");

        for (const record of clockedInRecords) {
            const employee = getEmployeeById(record.employeeId);
            if (!employee) continue;

            let clockInDate: Date;
            if (record.entradaTimestamp) {
                clockInDate = new Date(record.entradaTimestamp);
            } else {
                clockInDate = new Date(record.entrada!); // Fallback to string if no timestamp
                if (isNaN(clockInDate.getTime())) continue;
            }
            
            const schedule = getEmployeeDailyScheduleInfo(employee.id, clockInDate);

            if (schedule && schedule.isWorkDay && schedule.startTime && schedule.endTime) {
                const [startHour, startMinute] = schedule.startTime.split(':').map(Number);
                const [endHour, endMinute] = schedule.endTime.split(':').map(Number);

                const shiftStartTimeOnClockInDay = new Date(clockInDate.getFullYear(), clockInDate.getMonth(), clockInDate.getDate(), startHour, startMinute);
                let shiftEndTime = new Date(shiftStartTimeOnClockInDay);
                shiftEndTime.setHours(endHour, endMinute, 0, 0);

                if (shiftEndTime < shiftStartTimeOnClockInDay) {
                    shiftEndTime.setDate(shiftEndTime.getDate() + 1);
                }

                // Show from 15 mins before end time
                if (now.getTime() > (shiftEndTime.getTime() - 15 * 60 * 1000)) {
                    const timeDifferenceMinutes = Math.floor((now.getTime() - shiftEndTime.getTime()) / 60000);
                    employeesToTrack.push({
                        employee,
                        shiftEndTime: schedule.endTime,
                        timeDifferenceMinutes,
                        status: timeDifferenceMinutes < 0 ? 'upcoming' : 'late',
                        recordId: record.id,
                        recordDate: record.date,
                    });
                }
            }
        }
        setMissingClockOuts(employeesToTrack.sort((a, b) => b.timeDifferenceMinutes - a.timeDifferenceMinutes));
    };

    const intervalId = setInterval(updateMissingClockOuts, 60000);
    updateMissingClockOuts();

    return () => clearInterval(intervalId);
  }, [isLoadingData, activeEmployees, dailyRecords, getEmployeeById, getEmployeeDailyScheduleInfo]);


  // --- Memoized Data Calculations ---
  
  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    if (hour < 12) return "Buenos días";
    if (hour < 20) return "Buenas tardes";
    return "Buenas noches";
  }, []);
  
  const getResponsibleDisplayName = useCallback((username: string): string => {
      const user = users.find(u => u.username === username);
      if (user?.employeeId) {
          const employee = getEmployeeById(user.employeeId);
          return employee?.name || username;
      }
      return username;
  }, [users, getEmployeeById]);

  const { userClockingStatus, welcomeName } = useMemo(() => {
    if (!currentUser || employees.length === 0) {
      return { userClockingStatus: { status: 'unknown' }, welcomeName: currentUser?.username || 'Invitado' };
    }
    
    const employee = currentUser.employeeId ? getEmployeeById(currentUser.employeeId) : undefined;
    
    if (!employee) {
       return { userClockingStatus: { status: 'not_employee' }, welcomeName: currentUser.username };
    }
    
    const latestRecord = dailyRecords.find(r => r.employeeId === employee.id);
    
    let clockingStatus;
    if (!latestRecord) {
      clockingStatus = { status: 'out', time: 'Nunca' };
    } else if (latestRecord.entrada && !latestRecord.salida && latestRecord.entrada !== "SIN REGISTRO") {
      clockingStatus = { status: 'in', time: formatDisplayTime(latestRecord.entrada) };
    } else {
      clockingStatus = { status: 'out', time: formatDisplayTime(latestRecord.salida || latestRecord.entrada) };
    }
    
    return { userClockingStatus: clockingStatus, welcomeName: employee.name };

  }, [currentUser, employees, dailyRecords, getEmployeeById]);
  
  const latestRecordByEmployee = useMemo(() => {
    const recordMap = new Map<string, DailyTimeRecord>();
    dailyRecords.forEach(record => {
      if (!recordMap.has(record.employeeId) || (record.entradaTimestamp || record.salidaTimestamp || 0) > (recordMap.get(record.employeeId)!.entradaTimestamp || recordMap.get(record.employeeId)!.salidaTimestamp || 0)) {
        recordMap.set(record.employeeId, record);
      }
    });
    return recordMap;
  }, [dailyRecords]);

  const teamStatus = useMemo(() => {
    let presentCount = 0;
    latestRecordByEmployee.forEach(record => {
      if (record.entrada && !record.salida && record.entrada !== 'SIN REGISTRO') {
        presentCount++;
      }
    });
    
    const anomalies = Array.from(latestRecordByEmployee.values()).filter(r => r.salida === 'SIN REGISTRO' || r.entrada === 'SIN REGISTRO');

    return {
      present: presentCount,
      total: activeEmployees.length,
      anomalies: anomalies,
    };
  }, [activeEmployees, latestRecordByEmployee]);

  if (isLoadingData) {
    return <div className="p-6 text-center dark:text-gray-200">Cargando dashboard...</div>;
  }


  return (
    <div className="p-4 md:p-6 space-y-6">
      <h1 className="text-3xl font-semibold text-gray-800 dark:text-gray-100">
        {greeting}, <span className="text-sap-blue dark:text-sap-light-blue">{welcomeName}</span>!
      </h1>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-3">
            <StatusAndActionsPanel
                currentUser={currentUser}
                userClockingStatus={userClockingStatus}
                activeShiftReport={activeShiftReport}
                getResponsibleDisplayName={getResponsibleDisplayName}
                navigate={navigate}
                onOpenQuickNotes={handleOpenQuickNotes}
                hasUnreadNotes={hasUnreadNotes}
                setIsMetersModalOpen={setIsMetersModalOpen}
            />
        </div>

        <AlertsAndTeamStatusPanel
            upcomingEmployees={upcomingEmployees}
            missingClockOuts={missingClockOuts}
            teamStatus={teamStatus}
            shiftReports={shiftReports}
            onMissingClockOutDoubleClick={handleMissingClockOutDoubleClick}
            setShowReportDetailsModal={setShowReportDetailsModal}
            getResponsibleDisplayName={getResponsibleDisplayName}
            navigate={navigate}
            onUpcomingEmployeeDoubleClick={handleUpcomingEmployeeDoubleClick}
        />
      </div>
      
      <QuickNotesModal isOpen={isQuickNotesModalOpen} onClose={() => setIsQuickNotesModalOpen(false)} />
      <MetersModal isOpen={isMetersModalOpen} onClose={() => setIsMetersModalOpen(false)} />

      <ShiftReportModal
        isOpen={!!showReportDetailsModal}
        onClose={() => setShowReportDetailsModal(null)}
        report={showReportDetailsModal}
      />
      {employeeToClockIn && (
        <ConfirmationModal
            isOpen={!!employeeToClockIn}
            onClose={() => setEmployeeToClockIn(null)}
            onConfirm={handleConfirmClockIn}
            title="Confirmar Registro de Entrada"
            message={`¿Desea registrar la entrada para ${employeeToClockIn.employee.name} ahora?`}
            confirmText="Sí, Registrar Entrada"
            confirmVariant="primary"
        />
       )}
       {employeeToClockOut && (
        <ConfirmationModal
            isOpen={!!employeeToClockOut}
            onClose={() => setEmployeeToClockOut(null)}
            onConfirm={handleConfirmClockOut}
            title="Confirmar Registro de Salida"
            message={`¿Desea registrar la salida para ${employeeToClockOut.employee.name} ahora?`}
            confirmText="Sí, Registrar Salida"
            confirmVariant="danger"
        />
       )}
       {showResponsibleUserClockOutConfirmation && employeeToConfirmClockOut && (
            <ConfirmationModal
                isOpen={!!showResponsibleUserClockOutConfirmation}
                onClose={() => {
                    setShowResponsibleUserClockOutConfirmation(false);
                    setEmployeeToConfirmClockOut(null);
                }}
                onConfirm={handleConfirmResponsibleUserClockOut}
                title="Responsable de Turno Activo"
                message={
                    <>
                        <p>El empleado <strong>{employeeToConfirmClockOut.name}</strong> es el responsable del turno activo en el Libro de Novedades.</p>
                        <p className="mt-2 text-red-600 dark:text-red-400">¿Desea registrar la salida y <strong>cerrar automáticamente el turno</strong>? Esta acción finalizará su sesión.</p>
                    </>
                }
                confirmText="Sí, cerrar turno y salir"
                confirmVariant="danger"
            />
        )}
    </div>
  );
};

export default DashboardPage;